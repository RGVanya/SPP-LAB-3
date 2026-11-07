const { asyncHandler } = require('./asyncHandler');
const { unauthorized, invalidToken } = require('../errors/httpErrors');

/**
 * Проверяет временный ключ доступа (Bearer JWT) и актуальность сеанса.
 * Сеанс и роль читаются из БД на каждом запросе — отзыв сеанса и смена роли действуют сразу.
 */
function createAuthenticate({ tokenService, sessionRepository }) {
  return asyncHandler(async (req, res, next) => {
    const header = req.get('authorization');
    if (!header) throw unauthorized();

    const [scheme, token, extra] = header.split(' ');
    if (scheme.toLowerCase() !== 'bearer' || !token || extra !== undefined) {
      throw invalidToken('Malformed Authorization header');
    }

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch (error) {
      throw invalidToken(
        error.name === 'TokenExpiredError' ? 'The access token expired' : 'The access token is invalid',
      );
    }

    const auth = await sessionRepository.findActiveWithUser(payload.sid);
    if (!auth || auth.user.id !== payload.sub) throw invalidToken('The session has been revoked');

    req.user = auth.user;
    req.sessionId = auth.sessionId;
    await sessionRepository.touch(auth.sessionId);
    next();
  });
}

module.exports = { createAuthenticate };
