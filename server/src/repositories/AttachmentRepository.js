const { Attachment } = require('../models/Attachment');
const { isUuid } = require('../utils/isUuid');

const ATTACHMENT_COLUMNS = `
  id,
  task_id,
  original_name,
  stored_name,
  size,
  mime_type,
  uploaded_at
`;

function mapAttachment(row) {
  return new Attachment({
    id: row.id,
    taskId: row.task_id,
    originalName: row.original_name,
    storedName: row.stored_name,
    size: row.size,
    mimeType: row.mime_type,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
  });
}

class AttachmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByTaskIds(taskIds) {
    const ids = taskIds.filter(isUuid);
    if (ids.length === 0) return [];
    const result = await this.pool.query(
      `SELECT ${ATTACHMENT_COLUMNS}
       FROM attachments
       WHERE task_id = ANY($1::uuid[])
       ORDER BY uploaded_at ASC`,
      [ids],
    );
    return result.rows.map(mapAttachment);
  }

  async findByTaskAndId(taskId, attachmentId) {
    if (!isUuid(taskId) || !isUuid(attachmentId)) return null;
    const result = await this.pool.query(
      `SELECT ${ATTACHMENT_COLUMNS}
       FROM attachments
       WHERE task_id = $1 AND id = $2`,
      [taskId, attachmentId],
    );
    return result.rows[0] ? mapAttachment(result.rows[0]) : null;
  }

  async insert({ taskId, originalName, storedName, size, mimeType }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO attachments (task_id, original_name, stored_name, size, mime_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${ATTACHMENT_COLUMNS}`,
        [taskId, originalName, storedName, size, mimeType],
      );
      await client.query('UPDATE tasks SET updated_at = now() WHERE id = $1', [taskId]);
      await client.query('COMMIT');
      return mapAttachment(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(taskId, attachmentId) {
    if (!isUuid(taskId) || !isUuid(attachmentId)) return false;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'DELETE FROM attachments WHERE task_id = $1 AND id = $2',
        [taskId, attachmentId],
      );
      await client.query('UPDATE tasks SET updated_at = now() WHERE id = $1', [taskId]);
      await client.query('COMMIT');
      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { AttachmentRepository };
