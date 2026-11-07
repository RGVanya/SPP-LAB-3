const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupApp, bearer } = require('./helpers');

const TASK = { title: 'Задача', description: '', status: 'new', dueDate: '' };

describe('US1: матрица прав ролей', () => {
  const t = setupApp();
  const tokens = {};
  let task;
  let attachment;

  beforeEach(async () => {
    for (const role of ['viewer', 'editor', 'admin']) {
      tokens[role] = (await t.as(role)).token;
    }
    task = (await t.api().post('/api/tasks').set(bearer(tokens.editor)).send(TASK)).body.task;
    attachment = (await t.api().post(`/api/tasks/${task.id}/attachments`)
      .set(bearer(tokens.editor))
      .attach('file', Buffer.from('hello'), 'hello.txt')).body.attachment;
  });

  const operations = [
    { name: 'список задач', min: 'viewer', run: (tk) => t.api().get('/api/tasks').set(bearer(tk)) },
    { name: 'просмотр задачи', min: 'viewer', run: (tk) => t.api().get(`/api/tasks/${task.id}`).set(bearer(tk)) },
    {
      name: 'скачивание вложения',
      min: 'viewer',
      run: (tk) => t.api().get(`/api/tasks/${task.id}/attachments/${attachment.id}/download`).set(bearer(tk)),
    },
    { name: 'создание задачи', min: 'editor', run: (tk) => t.api().post('/api/tasks').set(bearer(tk)).send(TASK) },
    {
      name: 'изменение задачи',
      min: 'editor',
      run: (tk) => t.api().put(`/api/tasks/${task.id}`).set(bearer(tk)).send({ ...TASK, title: 'Новое' }),
    },
    {
      name: 'загрузка вложения',
      min: 'editor',
      run: (tk) => t.api().post(`/api/tasks/${task.id}/attachments`).set(bearer(tk))
        .attach('file', Buffer.from('x'), 'x.txt'),
    },
    {
      name: 'удаление вложения',
      min: 'editor',
      run: (tk) => t.api().delete(`/api/tasks/${task.id}/attachments/${attachment.id}`).set(bearer(tk)),
    },
    { name: 'удаление задачи', min: 'editor', run: (tk) => t.api().delete(`/api/tasks/${task.id}`).set(bearer(tk)) },
    { name: 'список пользователей', min: 'admin', run: (tk) => t.api().get('/api/admin/users').set(bearer(tk)) },
    { name: 'все сеансы', min: 'admin', run: (tk) => t.api().get('/api/admin/sessions').set(bearer(tk)) },
  ];

  const RANK = { viewer: 1, editor: 2, admin: 3 };

  for (const op of operations) {
    for (const role of ['viewer', 'editor', 'admin']) {
      const allowed = RANK[role] >= RANK[op.min];
      it(`${role}: ${op.name} → ${allowed ? 'разрешено' : '403'}`, async () => {
        const res = await op.run(tokens[role]);
        if (allowed) {
          assert.ok(res.status >= 200 && res.status < 300, `ожидался 2xx, получен ${res.status}`);
        } else {
          assert.equal(res.status, 403);
          assert.equal(res.body.type, '/problems/insufficient-role');
          assert.equal(res.body.requiredRole, op.min);
          assert.match(res.headers['www-authenticate'], /insufficient_scope/);
        }
      });
    }
  }

  it('все маршруты задач требуют ключ доступа (401 без него)', async () => {
    const calls = [
      t.api().get('/api/tasks'),
      t.api().post('/api/tasks').send(TASK),
      t.api().get(`/api/tasks/${task.id}`),
      t.api().put(`/api/tasks/${task.id}`).send(TASK),
      t.api().delete(`/api/tasks/${task.id}`),
      t.api().post(`/api/tasks/${task.id}/attachments`),
      t.api().delete(`/api/tasks/${task.id}/attachments/${attachment.id}`),
      t.api().get(`/api/tasks/${task.id}/attachments/${attachment.id}/download`),
      t.api().get('/api/admin/users'),
    ];
    for (const res of await Promise.all(calls)) assert.equal(res.status, 401);
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('админ повышает viewer до editor — права действуют со следующего запроса', async () => {
      const users = (await t.api().get('/api/admin/users').set(bearer(tokens.admin))).body.users;
      const viewer = users.find((u) => u.role === 'viewer');
      assert.equal(viewer.activeSessions, 1);

      const before = await t.api().post('/api/tasks').set(bearer(tokens.viewer)).send(TASK);
      assert.equal(before.status, 403);

      const res = await t.api().patch(`/api/admin/users/${viewer.id}`)
        .set(bearer(tokens.admin)).send({ role: 'editor' });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.role, 'editor');

      const after = await t.api().post('/api/tasks').set(bearer(tokens.viewer)).send(TASK);
      assert.equal(after.status, 201);
    });

    it('409 при попытке администратора понизить себя', async () => {
      const me = (await t.api().get('/api/auth/me').set(bearer(tokens.admin))).body.user;
      const res = await t.api().patch(`/api/admin/users/${me.id}`)
        .set(bearer(tokens.admin)).send({ role: 'viewer' });
      assert.equal(res.status, 409);
      assert.equal(res.body.type, '/problems/self-demotion');
    });

    it('422 для неизвестной роли, 404 для несуществующего пользователя', async () => {
      const users = (await t.api().get('/api/admin/users').set(bearer(tokens.admin))).body.users;
      const bad = await t.api().patch(`/api/admin/users/${users[0].id}`)
        .set(bearer(tokens.admin)).send({ role: 'root' });
      assert.equal(bad.status, 422);
      assert.ok(bad.body.fields.role);

      const missing = await t.api().patch(`/api/admin/users/${crypto.randomUUID()}`)
        .set(bearer(tokens.admin)).send({ role: 'editor' });
      assert.equal(missing.status, 404);
    });
  });
});
