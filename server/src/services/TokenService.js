const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { isUuid } = require('../utils/isUuid');

const ISSUER = 'task-manager';

/**
 * Временные ключи: короткоживущий JWT доступа и непрозрачный ключ обновления
 * вида `<sessionId>.<секрет>`. В БД хранятся только SHA-256 хеши секретов.
 */
class TokenService {
  constructor({ jwtSecret, accessTtlSeconds }) {
    this.secret = jwtSecret;
    this.accessTtlSeconds = accessTtlSeconds;
  }

  signAccessToken(user, sessionId) {
    return jwt.sign({ role: user.role, sid: sessionId }, this.secret, {
      algorithm: 'HS256',
      subject: user.id,
      issuer: ISSUER,
      expiresIn: this.accessTtlSeconds,
    });
  }

  // Бросает TokenExpiredError / JsonWebTokenError — их разбирает authenticate.
  verifyAccessToken(token) {
    return jwt.verify(token, this.secret, { algorithms: ['HS256'], issuer: ISSUER });
  }

  createRefreshToken(sessionId) {
    return `${sessionId}.${TokenService.randomSecret()}`;
  }

  parseRefreshToken(token) {
    if (typeof token !== 'string') return null;
    const [sessionId, secret, extra] = token.split('.');
    if (extra !== undefined || !isUuid(sessionId) || !secret) return null;
    return { sessionId };
  }

  static randomSecret() {
    return crypto.randomBytes(32).toString('base64url');
  }

  static hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}

module.exports = { TokenService };
