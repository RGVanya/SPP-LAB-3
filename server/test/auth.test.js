const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { setupApp, refreshCookie, bearer, PASSWORD } = require('./helpers');

describe('US1: регистрация, вход, временные ключи', () => {
  const t = setupApp();

  describe('POST /api/auth/register', () => {
    it('создаёт пользователя с ролью viewer, возвращает 201, Location, ключи и cookie', async () => {
      const res = await t.api().post('/api/auth/register')
        .send({ email: '  New.User@Example.com ', name: 'Новый', password: PASSWORD });

      assert.equal(res.status, 201);
      assert.equal(res.headers.location, '/api/auth/me');
      assert.equal(res.body.user.email, 'new.user@example.com');
      assert.equal(res.body.user.role, 'viewer');
      assert.equal(res.body.user.passwordHash, undefined);
      assert.equal(res.body.tokenType, 'Bearer');
      assert.equal(res.body.expiresIn, 900);
      assert.ok(res.body.accessToken);

      const cookie = res.headers['set-cookie'].find((c) => c.startsWith('refresh_token='));
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      assert.match(cookie, /Path=\/api\/auth/);
    });

    it('хранит пароль только в виде scrypt-хеша', async () => {
      await t.api().post('/api/auth/register').send({ email: 'a@b.ru', name: 'A', password: PASSWORD });
      const { rows } = await t.pool.query('SELECT password_hash FROM users');
      assert.match(rows[0].password_hash, /^scrypt\$/);
      assert.ok(!rows[0].password_hash.includes(PASSWORD));
    });

    it('409 при занятом e-mail (без учёта регистра)', async () => {
      await t.createUser('viewer', 'taken@example.com');
      const res = await t.api().post('/api/auth/register')
        .send({ email: 'TAKEN@example.com', name: 'Дубль', password: PASSWORD });
      assert.equal(res.status, 409);
      assert.equal(res.body.type, '/problems/email-taken');
    });

    it('422 с ошибками по полям при некорректных данных', async () => {
      const res = await t.api().post('/api/auth/register')
        .send({ email: 'not-an-email', name: '', password: 'short' });
      assert.equal(res.status, 422);
      assert.ok(res.body.fields.email);
      assert.ok(res.body.fields.name);
      assert.ok(res.body.fields.password);
    });
  });

  describe('POST /api/auth/login', () => {
    it('200 с ключами при верных данных', async () => {
      await t.createUser('editor');
      const res = await t.api().post('/api/auth/login')
        .send({ email: 'EDITOR@example.com', password: PASSWORD });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.role, 'editor');
      assert.ok(res.body.accessToken);
      assert.ok(refreshCookie(res));
    });

    it('401 с одинаковым ответом для неверного пароля и несуществующего e-mail', async () => {
      await t.createUser('editor');
      const wrongPassword = await t.api().post('/api/auth/login')
        .send({ email: 'editor@example.com', password: 'wrong-password' });
      const unknownEmail = await t.api().post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'wrong-password' });

      for (const res of [wrongPassword, unknownEmail]) {
        assert.equal(res.status, 401);
        assert.equal(res.body.type, '/problems/invalid-credentials');
        assert.equal(res.body.detail, 'Неверный e-mail или пароль');
        assert.match(res.headers['www-authenticate'], /^Bearer realm="tasks"/);
      }
    });
  });

  describe('GET /api/auth/me', () => {
    it('возвращает текущего пользователя по ключу доступа', async () => {
      const { token } = await t.as('viewer');
      const res = await t.api().get('/api/auth/me').set(bearer(token));
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'viewer@example.com');
    });

    it('401 без ключа, с WWW-Authenticate без кода ошибки', async () => {
      const res = await t.api().get('/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.headers['www-authenticate'], 'Bearer realm="tasks"');
      assert.equal(res.headers['content-type'], 'application/problem+json; charset=utf-8');
    });

    it('401 invalid_token для просроченного ключа', async () => {
      const user = await t.createUser('viewer');
      const { sessionId } = await t.login('viewer@example.com').then(async () => {
        const { rows } = await t.pool.query('SELECT id AS "sessionId" FROM sessions');
        return rows[0];
      });
      const jwt = require('jsonwebtoken');
      const expired = jwt.sign(
        { role: 'viewer', sid: sessionId, exp: Math.floor(Date.now() / 1000) - 10 },
        'test-secret',
        { subject: user.id, issuer: 'task-manager' },
      );
      const res = await t.api().get('/api/auth/me').set(bearer(expired));
      assert.equal(res.status, 401);
      assert.equal(res.body.type, '/problems/invalid-token');
      assert.match(res.headers['www-authenticate'], /error="invalid_token"/);
      assert.match(res.headers['www-authenticate'], /expired/);
    });

    it('401 для ключа, подписанного чужим секретом', async () => {
      const jwt = require('jsonwebtoken');
      const forged = jwt.sign({ role: 'admin', sid: crypto.randomUUID() }, 'other-secret', {
        subject: crypto.randomUUID(), issuer: 'task-manager', expiresIn: 60,
      });
      const res = await t.api().get('/api/auth/me').set(bearer(forged));
      assert.equal(res.status, 401);
      assert.equal(res.body.type, '/problems/invalid-token');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('выдаёт новую пару ключей и ротирует ключ обновления', async () => {
      await t.createUser('viewer');
      const { cookie } = await t.login('viewer@example.com');

      const res = await t.api().post('/api/auth/refresh').set('Cookie', cookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      const rotated = refreshCookie(res);
      assert.ok(rotated);
      assert.notEqual(rotated, cookie);

      const me = await t.api().get('/api/auth/me').set(bearer(res.body.accessToken));
      assert.equal(me.status, 200);
    });

    it('401 без cookie', async () => {
      const res = await t.api().post('/api/auth/refresh');
      assert.equal(res.status, 401);
      assert.equal(res.body.type, '/problems/invalid-refresh-token');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('204, очищает cookie и завершает сеанс — ключ обновления и доступа больше не работают', async () => {
      await t.createUser('viewer');
      const { cookie, token } = await t.login('viewer@example.com');

      const res = await t.api().post('/api/auth/logout').set('Cookie', cookie);
      assert.equal(res.status, 204);
      assert.match(res.headers['set-cookie'][0], /refresh_token=;/);

      const refresh = await t.api().post('/api/auth/refresh').set('Cookie', cookie);
      assert.equal(refresh.status, 401);
      const me = await t.api().get('/api/auth/me').set(bearer(token));
      assert.equal(me.status, 401);
    });
  });
});
