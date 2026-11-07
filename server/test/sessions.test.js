const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { setupApp, refreshCookie, bearer } = require('./helpers');

describe('US4: контроль активных сеансов', () => {
  const t = setupApp();

  it('список своих сеансов с пометкой текущего', async () => {
    await t.createUser('viewer');
    const first = await t.login('viewer@example.com', undefined, 'Firefox');
    await t.login('viewer@example.com', undefined, 'Chrome');

    const res = await t.api().get('/api/auth/sessions').set(bearer(first.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.sessions.length, 2);
    const current = res.body.sessions.find((s) => s.current);
    assert.equal(current.userAgent, 'Firefox');
    assert.ok(current.ip);
    assert.ok(current.createdAt && current.lastUsedAt && current.expiresAt);
  });

  it('завершённый сеанс теряет доступ немедленно', async () => {
    await t.createUser('viewer');
    const laptop = await t.login('viewer@example.com', undefined, 'Laptop');
    const phone = await t.login('viewer@example.com', undefined, 'Phone');

    const list = (await t.api().get('/api/auth/sessions').set(bearer(laptop.token))).body.sessions;
    const phoneSession = list.find((s) => s.userAgent === 'Phone');

    const res = await t.api().delete(`/api/auth/sessions/${phoneSession.id}`).set(bearer(laptop.token));
    assert.equal(res.status, 204);

    assert.equal((await t.api().get('/api/tasks').set(bearer(phone.token))).status, 401);
    assert.equal((await t.api().post('/api/auth/refresh').set('Cookie', phone.cookie)).status, 401);
    assert.equal((await t.api().get('/api/tasks').set(bearer(laptop.token))).status, 200);
  });

  it('нельзя завершить чужой сеанс через /api/auth/sessions (404)', async () => {
    await t.createUser('viewer');
    await t.createUser('editor');
    const viewer = await t.login('viewer@example.com');
    await t.login('editor@example.com');
    const { rows } = await t.pool.query(
      "SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.role = 'editor'",
    );
    const res = await t.api().delete(`/api/auth/sessions/${rows[0].id}`).set(bearer(viewer.token));
    assert.equal(res.status, 404);
  });

  it('«завершить все другие» оставляет только текущий', async () => {
    await t.createUser('viewer');
    const keep = await t.login('viewer@example.com', undefined, 'Keep');
    const other1 = await t.login('viewer@example.com', undefined, 'Other1');
    await t.login('viewer@example.com', undefined, 'Other2');

    const res = await t.api().delete('/api/auth/sessions').set(bearer(keep.token));
    assert.equal(res.status, 204);

    const list = (await t.api().get('/api/auth/sessions').set(bearer(keep.token))).body.sessions;
    assert.deepEqual(list.map((s) => s.userAgent), ['Keep']);
    assert.equal((await t.api().get('/api/tasks').set(bearer(other1.token))).status, 401);
  });

  it('не более 5 активных сеансов: 6-й вход завершает самый старый', async () => {
    await t.createUser('viewer');
    const oldest = await t.login('viewer@example.com', undefined, 'Device 1');
    for (let i = 2; i <= 6; i += 1) await t.login('viewer@example.com', undefined, `Device ${i}`);

    const { rows } = await t.pool.query(
      'SELECT user_agent, revoke_reason FROM sessions WHERE revoked_at IS NOT NULL',
    );
    assert.deepEqual(rows, [{ user_agent: 'Device 1', revoke_reason: 'session_limit' }]);
    assert.equal((await t.api().get('/api/tasks').set(bearer(oldest.token))).status, 401);
  });

  it('повторное использование ключа обновления завершает весь сеанс', async () => {
    await t.createUser('viewer');
    const { cookie: stolen } = await t.login('viewer@example.com');

    const legit = await t.api().post('/api/auth/refresh').set('Cookie', stolen);
    assert.equal(legit.status, 200);
    const fresh = refreshCookie(legit);

    const replay = await t.api().post('/api/auth/refresh').set('Cookie', stolen);
    assert.equal(replay.status, 401);

    // Сеанс убит целиком: и новый ключ владельца больше не действует.
    assert.equal((await t.api().post('/api/auth/refresh').set('Cookie', fresh)).status, 401);
    assert.equal((await t.api().get('/api/tasks').set(bearer(legit.body.accessToken))).status, 401);

    const { rows } = await t.pool.query('SELECT revoke_reason FROM sessions');
    assert.equal(rows[0].revoke_reason, 'refresh_reuse');
  });

  describe('администратор', () => {
    it('видит сеансы всех пользователей и завершает любой', async () => {
      const admin = await t.as('admin');
      const viewer = await t.as('viewer');

      const res = await t.api().get('/api/admin/sessions').set(bearer(admin.token));
      assert.equal(res.status, 200);
      const target = res.body.sessions.find((s) => s.user.email === 'viewer@example.com');
      assert.ok(target);

      const revoke = await t.api().delete(`/api/admin/sessions/${target.id}`).set(bearer(admin.token));
      assert.equal(revoke.status, 204);
      assert.equal((await t.api().get('/api/tasks').set(bearer(viewer.token))).status, 401);

      const again = await t.api().delete(`/api/admin/sessions/${target.id}`).set(bearer(admin.token));
      assert.equal(again.status, 404);
    });
  });
});
