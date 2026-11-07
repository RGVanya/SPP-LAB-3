const fs = require('fs');
const os = require('os');
const path = require('path');
const { Writable } = require('stream');
const { before, beforeEach, after } = require('node:test');
const request = require('supertest');
const baseConfig = require('../src/config');
const { createPool } = require('../src/db/pool');
const { createContainer } = require('../src/container');
const { createApp } = require('../src/app');
const { createLogger } = require('../src/logger');
const { MemoryMailer } = require('../src/services/Mailer');

const DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://tasks:tasks@localhost:55432/tasks_test';
const PASSWORD = 'Passw0rd!';

/**
 * Журнал в памяти: каждая строка pino разбирается как JSON.
 */
class LogCapture extends Writable {
  constructor() {
    super();
    this.lines = [];
  }

  _write(chunk, encoding, callback) {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) this.lines.push(line);
    }
    callback();
  }

  get entries() {
    return this.lines.map((line) => JSON.parse(line));
  }

  clear() {
    this.lines = [];
  }
}

function buildConfig(overrides = {}) {
  return {
    ...baseConfig,
    databaseUrl: DATABASE_URL,
    uploadsDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-uploads-')),
    clientDist: '',
    appUrl: 'http://app.test',
    ...overrides,
    auth: { ...baseConfig.auth, jwtSecret: 'test-secret', ...overrides.auth },
    limits: { ...baseConfig.limits, ...overrides.limits },
    seed: { adminEmail: '', adminPassword: '', adminName: '', demoPassword: '' },
  };
}

/**
 * Поднимает приложение против тестовой БД и чистит таблицы перед каждым тестом.
 * Возвращает объект, поля которого заполняются в хуке before.
 */
function setupApp(overrides = {}) {
  const ctx = {};

  before(async () => {
    ctx.config = buildConfig(overrides);
    ctx.pool = overrides.pool || createPool(ctx.config.databaseUrl);
    if (!overrides.pool) {
      const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
      await ctx.pool.query(schema);
    }
    ctx.mailer = new MemoryMailer();
    ctx.logs = new LogCapture();
    ctx.logger = createLogger({ level: 'info' }, ctx.logs);
    ctx.container = createContainer({
      pool: ctx.pool,
      config: ctx.config,
      mailer: ctx.mailer,
      logger: ctx.logger,
    });
    ctx.app = createApp({ ...ctx.container, config: ctx.config, logger: ctx.logger });
  });

  beforeEach(async () => {
    if (!overrides.pool) {
      await ctx.pool.query(
        'TRUNCATE users, sessions, rate_limits, password_reset_tokens, tasks, attachments CASCADE',
      );
    }
    ctx.mailer.clear();
    ctx.logs.clear();
  });

  after(async () => {
    if (!overrides.pool) await ctx.pool.end();
  });

  ctx.api = () => request(ctx.app);

  ctx.createUser = async (role = 'viewer', email = `${role}@example.com`, password = PASSWORD) => {
    const passwordHash = await ctx.container.passwordHasher.hash(password);
    return ctx.container.userRepository.insert({ email, name: `Тест ${role}`, passwordHash, role });
  };

  ctx.login = async (email, password = PASSWORD, agent = 'test-agent') => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('User-Agent', agent)
      .send({ email, password });
    if (res.status !== 200) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.accessToken, cookie: refreshCookie(res), user: res.body.user };
  };

  // Пользователь с ролью + открытый сеанс.
  ctx.as = async (role) => {
    await ctx.createUser(role);
    return ctx.login(`${role}@example.com`);
  };

  return ctx;
}

function refreshCookie(res) {
  const header = (res.headers['set-cookie'] || []).find((c) => c.startsWith('refresh_token='));
  return header ? header.split(';')[0] : null;
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { setupApp, refreshCookie, bearer, PASSWORD, DATABASE_URL };
