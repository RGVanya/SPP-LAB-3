const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { setupApp, bearer, PASSWORD } = require('./helpers');

describe('US6: структурированное логирование', () => {
  const t = setupApp();

  const requestLogs = () => t.logs.entries.filter((e) => e.req && e.res);
  const events = (name) => t.logs.entries.filter((e) => e.event === name);

  it('каждая строка журнала — JSON с level, time, msg', async () => {
    await t.api().get('/api/health');
    assert.ok(t.logs.lines.length > 0);
    for (const entry of t.logs.entries) {
      assert.equal(typeof entry.level, 'string');
      assert.ok(!Number.isNaN(Date.parse(entry.time)));
      assert.equal(typeof entry.msg, 'string');
    }
  });

  it('генерирует X-Request-Id и пишет запись запроса с userId, статусом и длительностью', async () => {
    const { token, user } = await t.as('viewer');
    t.logs.clear();

    const res = await t.api().get('/api/tasks').set(bearer(token));
    const id = res.headers['x-request-id'];
    assert.match(id, /^[0-9a-f-]{36}$/);

    const [entry] = requestLogs().filter((e) => e.reqId === id);
    assert.equal(entry.level, 'info');
    assert.equal(entry.req.method, 'GET');
    assert.equal(entry.req.url, '/api/tasks');
    assert.equal(entry.res.statusCode, 200);
    assert.equal(typeof entry.responseTime, 'number');
    assert.equal(entry.userId, user.id);
    assert.equal(entry.role, 'viewer');
  });

  it('принимает X-Request-Id клиента и использует его в журнале и теле ошибки', async () => {
    const res = await t.api().get('/api/tasks').set('X-Request-Id', 'client-req-42');
    assert.equal(res.headers['x-request-id'], 'client-req-42');
    assert.equal(res.body.requestId, 'client-req-42');
    const entries = requestLogs().filter((e) => e.reqId === 'client-req-42');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].level, 'warn');
  });

  it('отвергает небезопасный X-Request-Id и генерирует свой', async () => {
    const res = await t.api().get('/api/health').set('X-Request-Id', 'bad id\twith spaces');
    assert.notEqual(res.headers['x-request-id'], 'bad id\twith spaces');
  });

  it('пишет события безопасности с полем event', async () => {
    await t.createUser('admin');
    await t.createUser('viewer');
    await t.api().post('/api/auth/login').send({ email: 'viewer@example.com', password: 'wrong' });
    const admin = await t.login('admin@example.com');
    const viewer = (await t.api().get('/api/admin/users').set(bearer(admin.token))).body.users
      .find((u) => u.role === 'viewer');
    await t.api().patch(`/api/admin/users/${viewer.id}`).set(bearer(admin.token)).send({ role: 'editor' });
    await t.api().post('/api/auth/logout').set('Cookie', admin.cookie);

    const failed = events('auth.login.failed');
    assert.equal(failed.length, 1);
    assert.equal(failed[0].level, 'warn');
    assert.equal(failed[0].email, 'viewer@example.com');
    assert.ok(failed[0].reqId, 'событие связано с запросом');

    assert.equal(events('auth.login.success').length, 1);
    const roleChanged = events('user.role_changed')[0];
    assert.equal(roleChanged.from, 'viewer');
    assert.equal(roleChanged.to, 'editor');
    assert.equal(events('auth.logout').length, 1);
  });

  it('не пишет пароли и ключи в журнал', async () => {
    await t.api().post('/api/auth/register').send({ email: 'n@e.ru', name: 'N', password: PASSWORD });
    const { token, cookie } = await t.login('n@e.ru');
    await t.api().get('/api/tasks').set(bearer(token)).set('Cookie', cookie);
    await t.api().post('/api/auth/refresh').set('Cookie', cookie);

    const raw = t.logs.lines.join('\n');
    assert.ok(!raw.includes(PASSWORD), 'пароль в журнале');
    assert.ok(!raw.includes(token), 'ключ доступа в журнале');
    assert.ok(!raw.includes(cookie.split('=')[1]), 'ключ обновления в журнале');
  });

  it('ошибка 5xx пишется с уровнем error и стеком', async () => {
    const original = t.container.taskService.list;
    t.container.taskService.list = async () => { throw new Error('boom'); };
    try {
      const { token } = await t.as('viewer');
      const res = await t.api().get('/api/tasks').set(bearer(token));
      assert.equal(res.status, 500);
      assert.ok(!JSON.stringify(res.body).includes('boom'));
      const errorEntry = t.logs.entries.find((e) => e.err?.message === 'boom');
      assert.equal(errorEntry.level, 'error');
      assert.ok(errorEntry.err.stack);
    } finally {
      t.container.taskService.list = original;
    }
  });
});
