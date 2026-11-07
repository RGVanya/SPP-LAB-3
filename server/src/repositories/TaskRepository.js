const { Task } = require('../models/Task');
const { isUuid } = require('../utils/isUuid');

const TASK_COLUMNS = `
  id,
  title,
  description,
  status,
  to_char(due_date, 'YYYY-MM-DD') AS due_date,
  created_at,
  updated_at
`;

function mapTask(row) {
  return new Task({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.due_date,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

class TaskRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll(status) {
    const result = await this.pool.query(
      `SELECT ${TASK_COLUMNS}
       FROM tasks
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY due_date ASC NULLS LAST, created_at ASC`,
      [status],
    );
    return result.rows.map(mapTask);
  }

  async findById(id) {
    if (!isUuid(id)) return null;
    const result = await this.pool.query(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  }

  async insert({ title, description, status, dueDate }) {
    const result = await this.pool.query(
      `INSERT INTO tasks (title, description, status, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING ${TASK_COLUMNS}`,
      [title, description, status, dueDate],
    );
    return mapTask(result.rows[0]);
  }

  async update(id, { title, description, status, dueDate }) {
    if (!isUuid(id)) return null;
    const result = await this.pool.query(
      `UPDATE tasks
       SET title = $2,
           description = $3,
           status = $4,
           due_date = $5,
           updated_at = now()
       WHERE id = $1
       RETURNING ${TASK_COLUMNS}`,
      [id, title, description, status, dueDate],
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  }

  async delete(id) {
    if (!isUuid(id)) return false;
    const result = await this.pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
}

module.exports = { TaskRepository };
