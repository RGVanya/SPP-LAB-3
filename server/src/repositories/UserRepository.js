const { User } = require('../models/User');
const { isUuid } = require('../utils/isUuid');

const USER_COLUMNS = 'id, email, name, role, password_hash, created_at';

function mapUser(row) {
  return new User({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at).toISOString(),
    activeSessions: row.active_sessions === undefined ? undefined : Number(row.active_sessions),
  });
}

class UserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmail(email) {
    const result = await this.pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findById(id) {
    if (!isUuid(id)) return null;
    const result = await this.pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  // Нарушение уникальности e-mail (23505) обрабатывает сервис.
  async insert({ email, name, passwordHash, role }) {
    const result = await this.pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES (lower($1), $2, $3, $4)
       RETURNING ${USER_COLUMNS}`,
      [email, name, passwordHash, role],
    );
    return mapUser(result.rows[0]);
  }

  async listWithSessionCounts() {
    const result = await this.pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.created_at,
              count(s.id) AS active_sessions
       FROM users u
       LEFT JOIN sessions s
         ON s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now()
       GROUP BY u.id
       ORDER BY u.created_at ASC`,
    );
    return result.rows.map(mapUser);
  }

  async updateRole(id, role) {
    if (!isUuid(id)) return null;
    const result = await this.pool.query(
      `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [id, role],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async updatePassword(id, passwordHash) {
    await this.pool.query(
      'UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1',
      [id, passwordHash],
    );
  }
}

module.exports = { UserRepository };
