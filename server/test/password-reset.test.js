const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { setupApp, bearer, PASSWORD } = require('./helpers');

const NEW_PASSWORD = 'N3w-secure-pass';

function tokenFromMail(message) {
  const match = message.text.match(/reset-password\?token=([A-Za-z0-9_-]+)/);
  assert.ok(match, 'в письме есть ссылка со значением token');
  return match[1];
}

describe('US5: восстановление доступа через e-mail', () => {
  const t = setupApp({ trustProxy: 1 });

  function forgot(email, ip = '10.1.1.1') {
    return t.api().post('/api/auth/forgot-password').set('X-Forwarded-For', ip).send({ email });
  }

  it('202 и одинаковый ответ для существующего и несуществующего e-mail', async () => {
    await t.createUser('viewer');
    const known = await forgot('viewer@example.com');
    const unknown = await forgot('ghost@example.com');
    assert.equal(known.status, 202);
    assert.equal(unknown.status, 202);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(t.mailer.messages.length, 1);
    assert.equal(t.mailer.messages[0].to, 'viewer@example.com');
  });

  it('письмо содержит ссылку на приложение; в БД хранится только хеш токена', async () => {
    await t.createUser('viewer');
    await forgot('viewer@example.com');
    const [mail] = t.mailer.messages;
    assert.match(mail.text, /^http:\/\/app\.test\/reset-password\?token=/m);
    assert.match(mail.html, /reset-password\?token=/);
    const token = tokenFromMail(mail);
    const { rows } = await t.pool.query('SELECT token_hash FROM password_reset_tokens');
    assert.notEqual(rows[0].token_hash, token);
    assert.equal(rows[0].token_hash.length, 64);
  });

  it('сброс меняет пароль, завершает все сеансы, снимает блокировку и шлёт уведомление', async () => {
    await t.createUser('viewer');
    const session = await t.login('viewer@example.com');
    for (let i = 0; i < 5; i += 1) {
      await t.api().post('/api/auth/login').send({ email: 'viewer@example.com', password: 'bad' });
    }

    await forgot('viewer@example.com');
    const token = tokenFromMail(t.mailer.messages[0]);
    const res = await t.api().post('/api/auth/reset-password').send({ token, password: NEW_PASSWORD });
    assert.equal(res.status, 204);

    assert.equal((await t.api().get('/api/tasks').set(bearer(session.token))).status, 401);
    const oldLogin = await t.api().post('/api/auth/login')
      .send({ email: 'viewer@example.com', password: PASSWORD });
    assert.equal(oldLogin.status, 401);
    const newLogin = await t.api().post('/api/auth/login')
      .send({ email: 'viewer@example.com', password: NEW_PASSWORD });
    assert.equal(newLogin.status, 200);

    assert.equal(t.mailer.messages.length, 2);
    assert.match(t.mailer.messages[1].subject, /Пароль изменён/);
  });

  it('ссылка одноразовая', async () => {
    await t.createUser('viewer');
    await forgot('viewer@example.com');
    const token = tokenFromMail(t.mailer.messages[0]);
    await t.api().post('/api/auth/reset-password').send({ token, password: NEW_PASSWORD });
    const again = await t.api().post('/api/auth/reset-password').send({ token, password: 'Another-pass1' });
    assert.equal(again.status, 422);
    assert.equal(again.body.type, '/problems/invalid-reset-token');
    assert.ok(again.body.fields.token);
  });

  it('просроченная ссылка не работает', async () => {
    await t.createUser('viewer');
    await forgot('viewer@example.com');
    const token = tokenFromMail(t.mailer.messages[0]);
    await t.pool.query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second'");
    const res = await t.api().post('/api/auth/reset-password').send({ token, password: NEW_PASSWORD });
    assert.equal(res.status, 422);
  });

  it('новая ссылка аннулирует предыдущую', async () => {
    await t.createUser('viewer');
    await forgot('viewer@example.com');
    await forgot('viewer@example.com');
    const first = tokenFromMail(t.mailer.messages[0]);
    const second = tokenFromMail(t.mailer.messages[1]);
    assert.equal((await t.api().post('/api/auth/reset-password').send({ token: first, password: NEW_PASSWORD })).status, 422);
    assert.equal((await t.api().post('/api/auth/reset-password').send({ token: second, password: NEW_PASSWORD })).status, 204);
  });

  it('422 для слабого пароля', async () => {
    const res = await t.api().post('/api/auth/reset-password').send({ token: 'x', password: '123' });
    assert.equal(res.status, 422);
    assert.ok(res.body.fields.password);
  });

  it('не более 5 запросов восстановления за 15 минут с IP', async () => {
    for (let i = 0; i < 5; i += 1) assert.equal((await forgot(`u${i}@example.com`, '10.7.7.7')).status, 202);
    const sixth = await forgot('u6@example.com', '10.7.7.7');
    assert.equal(sixth.status, 429);
    assert.ok(Number(sixth.headers['retry-after']) > 0);
  });
});
