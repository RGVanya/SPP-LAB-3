const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { setupApp, PASSWORD } = require('./helpers');

function attempt(t, email, password = 'wrong-password', ip = '10.0.0.1') {
  return t.api().post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, password });
}

describe('US3: защита от подбора пароля', () => {
  // trustProxy=1, чтобы в тестах можно было имитировать разные IP через X-Forwarded-For.
  const t = setupApp({ trustProxy: 1 });

  it('сообщает, сколько попыток осталось', async () => {
    await t.createUser('editor');
    const res = await attempt(t, 'editor@example.com');
    assert.equal(res.status, 401);
    assert.equal(res.body.attemptsLeft, 4);
  });

  it('5-я неудача блокирует e-mail: 429 + Retry-After, даже с верным паролем', async () => {
    await t.createUser('editor');
    for (let i = 0; i < 4; i += 1) assert.equal((await attempt(t, 'editor@example.com')).status, 401);

    const fifth = await attempt(t, 'editor@example.com');
    assert.equal(fifth.status, 429);
    assert.equal(fifth.body.type, '/problems/too-many-attempts');
    const retryAfter = Number(fifth.headers['retry-after']);
    assert.ok(retryAfter > 14 * 60 && retryAfter <= 15 * 60, `Retry-After=${retryAfter}`);
    assert.equal(fifth.body.retryAfter, retryAfter);

    const correct = await attempt(t, 'editor@example.com', PASSWORD, '10.0.0.2');
    assert.equal(correct.status, 429);
  });

  it('блокировка наступает и для несуществующего e-mail (нельзя перечислить учётки)', async () => {
    for (let i = 0; i < 4; i += 1) await attempt(t, 'ghost@example.com');
    const res = await attempt(t, 'ghost@example.com');
    assert.equal(res.status, 429);
  });

  it('успешный вход обнуляет счётчик', async () => {
    await t.createUser('editor');
    for (let i = 0; i < 3; i += 1) await attempt(t, 'editor@example.com');
    assert.equal((await attempt(t, 'editor@example.com', PASSWORD)).status, 200);
    const res = await attempt(t, 'editor@example.com');
    assert.equal(res.body.attemptsLeft, 4);
  });

  it('по истечении блокировки вход снова возможен', async () => {
    await t.createUser('editor');
    for (let i = 0; i < 5; i += 1) await attempt(t, 'editor@example.com');
    await t.pool.query("UPDATE rate_limits SET locked_until = now() - interval '1 second'");
    assert.equal((await attempt(t, 'editor@example.com', PASSWORD)).status, 200);
  });

  it('20 неудач с одного IP по разным e-mail блокируют IP', async () => {
    await t.createUser('editor');
    for (let i = 0; i < 20; i += 1) {
      await attempt(t, `user${i}@example.com`, 'wrong', '10.9.9.9');
    }
    const blocked = await attempt(t, 'editor@example.com', PASSWORD, '10.9.9.9');
    assert.equal(blocked.status, 429);

    const otherIp = await attempt(t, 'editor@example.com', PASSWORD, '10.9.9.10');
    assert.equal(otherIp.status, 200);
  });
});
