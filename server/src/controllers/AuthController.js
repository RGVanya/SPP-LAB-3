const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/api/auth';

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function requestContext(req) {
  // ::ffff:10.0.0.1 → 10.0.0.1 (IPv4, отображённый в IPv6).
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  return { ip, userAgent: req.get('user-agent') || '', log: req.log };
}

class AuthController {
  constructor({ authService, sessionService, config }) {
    this.authService = authService;
    this.sessionService = sessionService;
    this.config = config;
  }

  register = async (req, res) => {
    const result = await this.authService.register(req.body, requestContext(req));
    this.#sendTokens(res.status(201).location(`${req.baseUrl}/me`), result);
  };

  login = async (req, res) => {
    const result = await this.authService.login(req.body, requestContext(req));
    this.#sendTokens(res, result);
  };

  refresh = async (req, res) => {
    try {
      const result = await this.authService.refresh(readCookie(req, REFRESH_COOKIE), requestContext(req));
      this.#sendTokens(res, result);
    } catch (error) {
      this.#clearCookie(res);
      throw error;
    }
  };

  logout = async (req, res) => {
    await this.authService.logout(readCookie(req, REFRESH_COOKIE), requestContext(req));
    this.#clearCookie(res);
    res.status(204).end();
  };

  me = async (req, res) => {
    res.json({ user: req.user });
  };

  forgotPassword = async (req, res) => {
    await this.authService.requestPasswordReset(req.body.email, requestContext(req));
    res.status(202).json({
      message: 'Если этот адрес зарегистрирован, мы отправили на него письмо со ссылкой для восстановления.',
    });
  };

  resetPassword = async (req, res) => {
    await this.authService.resetPassword(req.body, requestContext(req));
    res.status(204).end();
  };

  listSessions = async (req, res) => {
    const sessions = await this.sessionService.listOwn(req.user.id, req.sessionId);
    res.json({ sessions });
  };

  revokeSession = async (req, res) => {
    await this.sessionService.revokeOwn(req.user.id, req.params.sessionId, requestContext(req));
    res.status(204).end();
  };

  revokeOtherSessions = async (req, res) => {
    await this.sessionService.revokeOthers(req.user.id, req.sessionId, requestContext(req));
    res.status(204).end();
  };

  #sendTokens(res, { user, accessToken, expiresIn, refreshToken }) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.auth.cookieSecure,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: this.config.auth.refreshTtlSeconds * 1000,
    });
    res.json({ user, accessToken, tokenType: 'Bearer', expiresIn });
  }

  #clearCookie(res) {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.config.auth.cookieSecure,
      sameSite: 'strict',
      path: COOKIE_PATH,
    });
  }
}

module.exports = { AuthController, requestContext };
