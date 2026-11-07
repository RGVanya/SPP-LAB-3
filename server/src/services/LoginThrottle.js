const { tooManyRequests } = require('../errors/httpErrors');

/**
 * Защита от подбора: счётчики неудач по e-mail и по IP, плюс лимит запросов
 * восстановления пароля. Учёт одинаков для существующих и несуществующих e-mail.
 */
class LoginThrottle {
  constructor({ rateLimitRepository, limits }) {
    this.repository = rateLimitRepository;
    this.limits = limits;
  }

  #policy(limit) {
    return { limit, windowSeconds: this.limits.windowSeconds, lockSeconds: this.limits.lockSeconds };
  }

  async ensureLoginAllowed(email, ip) {
    const [byEmail, byIp] = await Promise.all([
      this.repository.retryAfter(`login:email:${email}`),
      this.repository.retryAfter(`login:ip:${ip}`),
    ]);
    const wait = Math.max(byEmail, byIp);
    if (wait > 0) throw tooManyRequests(wait);
  }

  /**
   * Возвращает { attemptsLeft, lockedFor }: lockedFor > 0 — эта неудача включила блокировку.
   */
  async registerFailure(email, ip) {
    const [byEmail, byIp] = await Promise.all([
      this.repository.hit(`login:email:${email}`, this.#policy(this.limits.loginPerEmail)),
      this.repository.hit(`login:ip:${ip}`, this.#policy(this.limits.loginPerIp)),
    ]);
    return {
      attemptsLeft: Math.max(0, this.limits.loginPerEmail - byEmail.hits),
      lockedFor: Math.max(byEmail.lockedFor, byIp.lockedFor),
    };
  }

  async resetEmail(email) {
    await this.repository.reset(`login:email:${email}`);
  }

  async consumePasswordReset(ip) {
    const key = `forgot:ip:${ip}`;
    const wait = await this.repository.retryAfter(key);
    if (wait > 0) {
      throw tooManyRequests(wait, 'Слишком много запросов восстановления. Повторите позже.');
    }
    await this.repository.hit(key, this.#policy(this.limits.forgotPerIp));
  }
}

module.exports = { LoginThrottle };
