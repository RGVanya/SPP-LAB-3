const { ROLE } = require('../models/User');
const { securityEvent } = require('../logger');
const { conflict, notFound } = require('../errors/httpErrors');

class UserService {
  constructor({ userRepository, passwordHasher }) {
    this.users = userRepository;
    this.hasher = passwordHasher;
  }

  list() {
    return this.users.listWithSessionCounts();
  }

  async changeRole(actor, userId, role, ctx) {
    // Иначе система может остаться без единого администратора.
    if (actor.id === userId && role !== ROLE.ADMIN) {
      throw conflict('Нельзя понизить собственную роль администратора', 'self-demotion');
    }
    const existing = await this.users.findById(userId);
    if (!existing) throw notFound('Пользователь не найден');

    const user = await this.users.updateRole(userId, role);
    securityEvent(ctx.log, 'user.role_changed', {
      actorId: actor.id,
      targetUserId: user.id,
      from: existing.role,
      to: role,
    });
    return user;
  }

  /**
   * Создаёт администратора (и демо-пользователей) при старте, если их ещё нет.
   */
  async seed({ adminEmail, adminPassword, adminName, demoPassword }, logger) {
    const accounts = [];
    if (adminEmail && adminPassword) {
      accounts.push({ email: adminEmail, name: adminName, password: adminPassword, role: ROLE.ADMIN });
    }
    if (demoPassword) {
      accounts.push(
        { email: 'editor@example.com', name: 'Редактор (демо)', password: demoPassword, role: ROLE.EDITOR },
        { email: 'viewer@example.com', name: 'Наблюдатель (демо)', password: demoPassword, role: ROLE.VIEWER },
      );
    }

    for (const account of accounts) {
      if (await this.users.findByEmail(account.email)) continue;
      const user = await this.users.insert({
        email: account.email,
        name: account.name,
        role: account.role,
        passwordHash: await this.hasher.hash(account.password),
      });
      logger.info({ event: 'user.seeded', userId: user.id, email: user.email, role: user.role },
        `Создан пользователь ${user.email} (${user.role})`);
    }
  }
}

module.exports = { UserService };
