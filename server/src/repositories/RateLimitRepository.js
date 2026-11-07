// Окно истекло или прошлая блокировка закончилась — счёт начинается заново.
const WINDOW_RESET = `r.window_started_at < now() - make_interval(secs => $2) OR r.locked_until <= now()`;

class RateLimitRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // Сколько секунд осталось до снятия блокировки (0 — блокировки нет).
  async retryAfter(key) {
    const result = await this.pool.query(
      `SELECT ceil(extract(epoch FROM locked_until - now()))::int AS seconds
       FROM rate_limits WHERE key = $1 AND locked_until > now()`,
      [key],
    );
    return result.rows[0]?.seconds || 0;
  }

  /**
   * Атомарно учитывает событие и при достижении лимита ставит блокировку.
   * Возвращает число событий в окне и длительность блокировки (0 — не заблокирован).
   */
  async hit(key, { limit, windowSeconds, lockSeconds }) {
    const counted = await this.pool.query(
      `INSERT INTO rate_limits AS r (key, hits, window_started_at) VALUES ($1, 1, now())
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN ${WINDOW_RESET} THEN 1 ELSE r.hits + 1 END,
         window_started_at = CASE WHEN ${WINDOW_RESET} THEN now() ELSE r.window_started_at END,
         locked_until = CASE WHEN ${WINDOW_RESET} THEN NULL ELSE r.locked_until END
       RETURNING hits`,
      [key, windowSeconds],
    );
    const { hits } = counted.rows[0];
    if (hits < limit) return { hits, lockedFor: 0 };

    await this.pool.query(
      'UPDATE rate_limits SET locked_until = now() + make_interval(secs => $2) WHERE key = $1',
      [key, lockSeconds],
    );
    return { hits, lockedFor: lockSeconds };
  }

  async reset(key) {
    await this.pool.query('DELETE FROM rate_limits WHERE key = $1', [key]);
  }
}

module.exports = { RateLimitRepository };
