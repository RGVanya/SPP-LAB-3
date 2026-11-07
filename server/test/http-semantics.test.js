const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupApp, bearer } = require('./helpers');

const TASK = { title: 'Задача', status: 'new' };

function assertProblem(res, status, type) {
  assert.equal(res.status, status);
  assert.match(res.headers['content-type'], /^application\/problem\+json/);
  assert.equal(res.body.status, status);
  assert.equal(res.body.type, `/problems/${type}`);
  assert.ok(res.body.title, 'title обязателен');
  assert.ok(res.body.detail, 'detail обязателен');
  assert.ok(res.body.instance.startsWith('/api'), 'instance — путь запроса');
  assert.equal(res.body.requestId, res.headers['x-request-id']);
  assert.equal(res.body.stack, undefined);
}

describe('US2: коды ответов и формат problem+json', () => {
  const t = setupApp();
  let token;

  beforeEach(async () => {
    token = (await t.as('editor')).token;
  });

  it('201 + Location при создании задачи', async () => {
    const res = await t.api().post('/api/tasks').set(bearer(token)).send(TASK);
    assert.equal(res.status, 201);
    assert.equal(res.headers.location, `/api/tasks/${res.body.task.id}`);
  });

  it('201 + Location при загрузке вложения', async () => {
    const task = (await t.api().post('/api/tasks').set(bearer(token)).send(TASK)).body.task;
    const res = await t.api().post(`/api/tasks/${task.id}/attachments`).set(bearer(token))
      .attach('file', Buffer.from('data'), 'a.txt');
    assert.equal(res.status, 201);
    assert.equal(
      res.headers.location,
      `/api/tasks/${task.id}/attachments/${res.body.attachment.id}/download`,
    );
  });

  it('400 при синтаксически неверном JSON', async () => {
    const res = await t.api().post('/api/tasks').set(bearer(token))
      .set('Content-Type', 'application/json').send('{"title": ');
    assertProblem(res, 400, 'malformed-request');
  });

  it('401 без ключа', async () => {
    const res = await t.api().get('/api/tasks');
    assertProblem(res, 401, 'unauthorized');
  });

  it('403 при недостаточной роли', async () => {
    const viewer = await t.as('viewer');
    const res = await t.api().post('/api/tasks').set(bearer(viewer.token)).send(TASK);
    assertProblem(res, 403, 'insufficient-role');
  });

  it('404 для несуществующей задачи и неизвестного адреса API', async () => {
    assertProblem(await t.api().get(`/api/tasks/${crypto.randomUUID()}`).set(bearer(token)), 404, 'not-found');
    assertProblem(await t.api().get('/api/unknown'), 404, 'not-found');
  });

  it('405 + Allow для неподдерживаемого метода', async () => {
    const res = await t.api().patch('/api/tasks').set(bearer(token));
    assertProblem(res, 405, 'method-not-allowed');
    assert.equal(res.headers.allow, 'GET, HEAD, POST');

    const item = await t.api().post(`/api/tasks/${crypto.randomUUID()}`).set(bearer(token));
    assert.equal(item.status, 405);
    assert.equal(item.headers.allow, 'GET, HEAD, PUT, DELETE');
  });

  it('OPTIONS → 204 + Allow', async () => {
    const res = await t.api().options('/api/tasks').set(bearer(token));
    assert.equal(res.status, 204);
    assert.equal(res.headers.allow, 'GET, HEAD, POST');
  });

  it('409 при регистрации занятого e-mail', async () => {
    const res = await t.api().post('/api/auth/register')
      .send({ email: 'editor@example.com', name: 'X', password: 'Passw0rd!' });
    assertProblem(res, 409, 'email-taken');
  });

  it('413 для JSON больше 1 МБ', async () => {
    const res = await t.api().post('/api/tasks').set(bearer(token))
      .send({ ...TASK, description: 'x'.repeat(1024 * 1024 + 10) });
    assertProblem(res, 413, 'payload-too-large');
    assert.equal(res.body.title, 'Content Too Large');
  });

  it('415 для тела не в JSON', async () => {
    const res = await t.api().post('/api/tasks').set(bearer(token))
      .set('Content-Type', 'text/plain').send('title=x');
    assertProblem(res, 415, 'unsupported-media-type');
  });

  it('415 для загрузки файла не в multipart/form-data', async () => {
    const task = (await t.api().post('/api/tasks').set(bearer(token)).send(TASK)).body.task;
    const res = await t.api().post(`/api/tasks/${task.id}/attachments`).set(bearer(token)).send({ file: 'x' });
    assertProblem(res, 415, 'unsupported-media-type');
  });

  it('422 с полями при нарушении правил валидации', async () => {
    const res = await t.api().post('/api/tasks').set(bearer(token)).send({ title: '', status: 'bad' });
    assertProblem(res, 422, 'validation-error');
    assert.equal(res.body.title, 'Unprocessable Content');
    assert.ok(res.body.fields.title);
    assert.ok(res.body.fields.status);
  });

  it('422 при загрузке без файла', async () => {
    const task = (await t.api().post('/api/tasks').set(bearer(token)).send(TASK)).body.task;
    const res = await t.api().post(`/api/tasks/${task.id}/attachments`).set(bearer(token))
      .field('note', 'без файла');
    assertProblem(res, 422, 'validation-error');
    assert.ok(res.body.fields.file);
  });

  it('204 при удалении', async () => {
    const task = (await t.api().post('/api/tasks').set(bearer(token)).send(TASK)).body.task;
    const res = await t.api().delete(`/api/tasks/${task.id}`).set(bearer(token));
    assert.equal(res.status, 204);
  });
});

describe('US2: 503 при недоступной БД', () => {
  const failingPool = {
    async query() {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      throw error;
    },
    async connect() {
      return this.query();
    },
  };
  const t = setupApp({ pool: failingPool });

  it('/api/health → 503 + Retry-After', async () => {
    const res = await t.api().get('/api/health');
    assertProblem(res, 503, 'service-unavailable');
    assert.equal(res.headers['retry-after'], '5');
  });

  it('ответ об ошибке БД не раскрывает внутренние детали', async () => {
    const res = await t.api().post('/api/auth/login').send({ email: 'a@b.ru', password: 'x' });
    assert.equal(res.status, 503);
    assert.ok(!JSON.stringify(res.body).includes('ECONNREFUSED'));
  });
});
