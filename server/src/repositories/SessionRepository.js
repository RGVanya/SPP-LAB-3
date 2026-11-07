const { User } = require('../models/User');
const { isUuid } = require('../utils/isUuid');

const ACTIVE = 's.revoked_at IS NULL AND s.expires_at > now()';

const SESSION_COLUMNS = `
  s.id, s.user_id, s.user_agent, s.ip, s.created_at, s.last_used_at, s.expires_at
`;

function mapSession(row) {
  const session = {
    id: row.id,
    userId: row.user_id,
    userAgent: row.user_agent,
    ip: row.ip,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: new Date(row.last_used_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
  if (row.user_email) {
    session.user = { id: row.user_id, email: row.user_email, name: row.user_name, role: row.user_role };
  }
  return session;
}

class SessionRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ id, userId, refreshHash, userAgent, ip, ttlSeconds }) {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, refresh_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))`,
      [id, userId, refreshHash, userAgent.slice(0, 512), ip, ttlSeconds],
    );
  }

  // Один запрос на каждый HTTP-запрос: активный сеанс + актуальная роль пользователя.
  async findActiveWithUser(sessionId) {
    if (!isUuid(sessionId)) return null;
    const result = await this.pool.query(
      `SELECT s.id AS session_id, u.id, u.email, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND ${ACTIVE}`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      sessionId: row.session_id,
      user: new User({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: new Date(row.created_at).toISOString(),
      }),
    };
  }

  async findActive(sessionId) {
    if (!isUuid(sessionId)) return null;
    const result = await this.pool.query(
      `SELECT ${SESSION_COLUMNS}, s.refresh_hash FROM sessions s WHERE s.id = $1 AND ${ACTIVE}`,
      [sessionId],
    );
    const row = result.rows[0];
    return row ? { ...mapSession(row), refreshHash: row.refresh_hash } : null;
  }

  // Атомарная ротация (compare-and-swap): из двух одновременных обменов одного ключа выиграет один.
  async rotate(sessionId, oldHash, newHash, ttlSeconds) {
    const result = await this.pool.query(
      `UPDATE sessions s
       SET refresh_hash = $3, last_used_at = now(), expires_at = now() + make_interval(secs => $4)
       WHERE s.id = $1 AND s.refresh_hash = $2 AND ${ACTIVE}`,
      [sessionId, oldHash, newHash, ttlSeconds],
    );
    return result.rowCount > 0;
  }

  // Обновляем «последнюю активность» не чаще раза в минуту, чтобы не писать в БД на каждый запрос.
  async touch(sessionId) {
    await this.pool.query(
      `UPDATE sessions SET last_used_at = now()
       WHERE id = $1 AND last_used_at < now() - interval '1 minute'`,
      [sessionId],
    );
  }

  async revoke(sessionId, reason, userId = null) {
    if (!isUuid(sessionId)) return null;
    const result = await this.pool.query(
      `UPDATE sessions s SET revoked_at = now(), revoke_reason = $2
       WHERE s.id = $1 AND ($3::uuid IS NULL OR s.user_id = $3) AND ${ACTIVE}
       RETURNING s.id, s.user_id`,
      [sessionId, reason, userId],
    );
    return result.rows[0] ? { id: result.rows[0].id, userId: result.rows[0].user_id } : null;
  }

  async revokeAllForUser(userId, reason, exceptSessionId = null) {
    const result = await this.pool.query(
      `UPDATE sessions s SET revoked_at = now(), revoke_reason = $2
       WHERE s.user_id = $1 AND ($3::uuid IS NULL OR s.id <> $3) AND ${ACTIVE}`,
      [userId, reason, exceptSessionId],
    );
    return result.rowCount;
  }

  // Оставляет `max` самых новых активных сеансов, остальные завершает.
  async enforceLimit(userId, max) {
    const result = await this.pool.query(
      `UPDATE sessions SET revoked_at = now(), revoke_reason = 'session_limit'
       WHERE id IN (
         SELECT s.id FROM sessions s
         WHERE s.user_id = $1 AND ${ACTIVE}
         ORDER BY s.created_at DESC
         OFFSET $2
       )
       RETURNING id`,
      [userId, max],
    );
    return result.rows.map((row) => row.id);
  }

  async listActiveByUser(userId) {
    const result = await this.pool.query(
      `SELECT ${SESSION_COLUMNS} FROM sessions s
       WHERE s.user_id = $1 AND ${ACTIVE}
       ORDER BY s.last_used_at DESC`,
      [userId],
    );
    return result.rows.map(mapSession);
  }

  async listActive() {
    const result = await this.pool.query(
      `SELECT ${SESSION_COLUMNS},
              u.email AS user_email, u.name AS user_name, u.role AS user_role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE ${ACTIVE}
       ORDER BY s.last_used_at DESC`,
    );
    return result.rows.map(mapSession);
  }
}

module.exports = { SessionRepository };
