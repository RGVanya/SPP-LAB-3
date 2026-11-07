const crypto = require('crypto');
const { ROLE } = require('../models/User');
const { TokenService } = require('./TokenService');
const { passwordResetMessage, passwordChangedMessage } = require('./Mailer');
const { securityEvent } = require('../logger');
const {
  conflict,
  unauthorized,
  invalidRefreshToken,
  tooManyRequests,
  validationError,
} = require('../errors/httpErrors');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Аутентификация на временных ключах: регистрация, вход, обмен ключа обновления,
 * выход и восстановление пароля.
 *
 * ctx — контекст запроса: { ip, userAgent, log }.
 */
class AuthService {
  constructor({
    userRepository,
    sessionRepository,
    passwordResetRepository,
    passwordHasher,
    tokenService,
    loginThrottle,
    mailer,
    config,
  }) {
    this.users = userRepository;
    this.sessions = sessionRepository;
    this.resets = passwordResetRepository;
    this.hasher = passwordHasher;
    this.tokens = tokenService;
    this.throttle = loginThrottle;
    this.mailer = mailer;
    this.config = config;
    this.dummyHash = null;
  }

  async register({ email, name, password }, ctx) {
    const normalized = normalizeEmail(email);
    if (await this.users.findByEmail(normalized)) throw this.#emailTaken();

    let user;
    try {
      user = await this.users.insert({
        email: normalized,
        name: name.trim(),
        passwordHash: await this.hasher.hash(password),
        role: ROLE.VIEWER,
      });
    } catch (error) {
      if (error.code === '23505') throw this.#emailTaken();
      throw error;
    }

    securityEvent(ctx.log, 'user.registered', { userId: user.id, email: user.email, ip: ctx.ip });
    return this.#openSession(user, ctx);
  }

  async login({ email, password }, ctx) {
    const normalized = normalizeEmail(email);
    await this.throttle.ensureLoginAllowed(normalized, ctx.ip);

    const user = await this.users.findByEmail(normalized);
    // Для несуществующего e-mail всё равно считаем scrypt — время ответа не выдаёт наличие учётки.
    const valid = await this.hasher.verify(password, user ? user.passwordHash : await this.#dummyHash());

    if (!user || !valid) {
      const { attemptsLeft, lockedFor } = await this.throttle.registerFailure(normalized, ctx.ip);
      securityEvent(ctx.log, 'auth.login.failed', {
        email: normalized,
        ip: ctx.ip,
        reason: user ? 'wrong_password' : 'unknown_email',
        attemptsLeft,
      }, 'warn');
      if (lockedFor > 0) {
        securityEvent(ctx.log, 'auth.login.locked', { email: normalized, ip: ctx.ip, lockedFor }, 'warn');
        throw tooManyRequests(lockedFor);
      }
      throw unauthorized('Неверный e-mail или пароль', {
        type: 'invalid-credentials',
        extensions: { attemptsLeft },
      });
    }

    await this.throttle.resetEmail(normalized);
    const result = await this.#openSession(user, ctx);
    securityEvent(ctx.log, 'auth.login.success', {
      userId: user.id,
      sessionId: result.sessionId,
      ip: ctx.ip,
    });
    return result;
  }

  async refresh(refreshToken, ctx) {
    const parsed = this.tokens.parseRefreshToken(refreshToken);
    if (!parsed) throw invalidRefreshToken();

    const session = await this.sessions.findActive(parsed.sessionId);
    if (!session) throw invalidRefreshToken();

    const next = this.tokens.createRefreshToken(session.id);
    const rotated = await this.sessions.rotate(
      session.id,
      TokenService.hash(refreshToken),
      TokenService.hash(next),
      this.config.auth.refreshTtlSeconds,
    );

    if (!rotated) {
      // Предъявлен уже использованный ключ: его кто-то скопировал. Сеанс закрываем целиком.
      await this.sessions.revoke(session.id, 'refresh_reuse');
      securityEvent(ctx.log, 'auth.refresh.reuse_detected', {
        userId: session.userId,
        sessionId: session.id,
        ip: ctx.ip,
      }, 'warn');
      throw invalidRefreshToken('Сеанс завершён из соображений безопасности. Войдите снова.');
    }

    const user = await this.users.findById(session.userId);
    return this.#tokensFor(user, session.id, next);
  }

  async logout(refreshToken, ctx) {
    const parsed = this.tokens.parseRefreshToken(refreshToken);
    if (!parsed) return;
    const session = await this.sessions.findActive(parsed.sessionId);
    if (!session || session.refreshHash !== TokenService.hash(refreshToken)) return;
    await this.sessions.revoke(session.id, 'logout');
    securityEvent(ctx.log, 'auth.logout', { userId: session.userId, sessionId: session.id });
  }

  async requestPasswordReset(email, ctx) {
    await this.throttle.consumePasswordReset(ctx.ip);
    const normalized = normalizeEmail(email);
    const user = await this.users.findByEmail(normalized);
    securityEvent(ctx.log, 'auth.password_reset.requested', {
      email: normalized,
      ip: ctx.ip,
      userId: user?.id ?? null,
    });
    if (!user) return;

    const token = TokenService.randomSecret();
    const { resetTtlSeconds } = this.config.auth;
    await this.resets.issue(user.id, TokenService.hash(token), resetTtlSeconds);

    const url = `${this.config.appUrl}/reset-password?token=${token}`;
    // Не ждём SMTP: время ответа не должно зависеть от того, существует ли адрес.
    this.#sendSafely(passwordResetMessage({ user, url, ttlMinutes: resetTtlSeconds / 60 }), ctx);
  }

  async resetPassword({ token, password }, ctx) {
    const userId = await this.resets.consume(TokenService.hash(String(token)));
    if (!userId) {
      throw validationError(
        { token: 'Ссылка недействительна или устарела. Запросите новую.' },
        'Ссылка восстановления недействительна или устарела',
        'invalid-reset-token',
      );
    }

    const user = await this.users.findById(userId);
    await this.users.updatePassword(user.id, await this.hasher.hash(password));
    const revoked = await this.sessions.revokeAllForUser(user.id, 'password_reset');
    await this.throttle.resetEmail(user.email);

    securityEvent(ctx.log, 'auth.password_reset.completed', {
      userId: user.id,
      revokedSessions: revoked,
      ip: ctx.ip,
    });
    this.#sendSafely(passwordChangedMessage({ user, ip: ctx.ip }), ctx);
  }

  async #openSession(user, ctx) {
    const sessionId = crypto.randomUUID();
    const refreshToken = this.tokens.createRefreshToken(sessionId);
    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      refreshHash: TokenService.hash(refreshToken),
      userAgent: ctx.userAgent,
      ip: ctx.ip,
      ttlSeconds: this.config.auth.refreshTtlSeconds,
    });

    const evicted = await this.sessions.enforceLimit(user.id, this.config.auth.maxSessions);
    if (evicted.length > 0) {
      securityEvent(ctx.log, 'session.evicted', { userId: user.id, sessionIds: evicted });
    }
    return this.#tokensFor(user, sessionId, refreshToken);
  }

  #tokensFor(user, sessionId, refreshToken) {
    return {
      user,
      sessionId,
      refreshToken,
      accessToken: this.tokens.signAccessToken(user, sessionId),
      expiresIn: this.config.auth.accessTtlSeconds,
    };
  }

  #sendSafely(message, ctx) {
    this.mailer.send(message).catch((err) => {
      ctx.log.error({ err, to: message.to, subject: message.subject }, 'Не удалось отправить письмо');
    });
  }

  #dummyHash() {
    if (!this.dummyHash) this.dummyHash = this.hasher.hash(crypto.randomUUID());
    return this.dummyHash;
  }

  #emailTaken() {
    return conflict('Пользователь с таким e-mail уже зарегистрирован', 'email-taken');
  }
}

module.exports = { AuthService, normalizeEmail };
