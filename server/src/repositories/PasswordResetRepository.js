class PasswordResetRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // Новая ссылка аннулирует все прежние неиспользованные ссылки пользователя.
  async issue(userId, tokenHash, ttlSeconds) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
        [userId],
      );
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(secs => $3))`,
        [userId, tokenHash, ttlSeconds],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Атомарно «гасит» действующий токен; возвращает id пользователя или null.
  async consume(tokenHash) {
    const result = await this.pool.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [tokenHash],
    );
    return result.rows[0]?.user_id || null;
  }
}

module.exports = { PasswordResetRepository };
