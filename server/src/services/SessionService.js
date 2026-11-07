const { securityEvent } = require('../logger');
const { notFound } = require('../errors/httpErrors');

class SessionService {
  constructor({ sessionRepository }) {
    this.sessions = sessionRepository;
  }

  async listOwn(userId, currentSessionId) {
    const sessions = await this.sessions.listActiveByUser(userId);
    return sessions.map((session) => ({ ...session, current: session.id === currentSessionId }));
  }

  async revokeOwn(userId, sessionId, ctx) {
    const revoked = await this.sessions.revoke(sessionId, 'user_revoked', userId);
    if (!revoked) throw notFound('Активный сеанс не найден');
    securityEvent(ctx.log, 'session.revoked', { userId, sessionId, by: 'user' });
  }

  async revokeOthers(userId, currentSessionId, ctx) {
    const count = await this.sessions.revokeAllForUser(userId, 'user_revoked', currentSessionId);
    securityEvent(ctx.log, 'session.revoked_others', { userId, count });
  }

  listAll() {
    return this.sessions.listActive();
  }

  async revokeAny(actor, sessionId, ctx) {
    const revoked = await this.sessions.revoke(sessionId, 'admin_revoked');
    if (!revoked) throw notFound('Активный сеанс не найден');
    securityEvent(ctx.log, 'session.revoked', {
      userId: revoked.userId,
      sessionId,
      by: 'admin',
      actorId: actor.id,
    });
  }
}

module.exports = { SessionService };
