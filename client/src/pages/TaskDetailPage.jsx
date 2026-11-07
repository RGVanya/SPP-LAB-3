import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../api/context';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner, NoticeBanner } from '../components/Banners';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateTime, formatFileSize } from '../format';

function fileIcon(mimeType = '') {
  if (mimeType.startsWith('image/'))                                   return '🖼';
  if (mimeType.startsWith('video/'))                                   return '🎬';
  if (mimeType.startsWith('audio/'))                                   return '🎵';
  if (mimeType.includes('pdf'))                                        return '📄';
  if (mimeType.includes('zip') || mimeType.includes('archive'))        return '🗜';
  if (mimeType.includes('word') || mimeType.includes('document'))      return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel'))        return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('power')) return '📽';
  if (mimeType.startsWith('text/'))                                    return '📃';
  return '📎';
}

function getDueSeverity(dueDate) {
  if (!dueDate) return 'none';
  const due = new Date(dueDate);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (due < now) return 'overdue';
  const soon = new Date(now); soon.setDate(soon.getDate() + 3);
  if (due <= soon) return 'soon';
  return 'ok';
}

const DUE_LABEL = {
  none:    null,
  ok:      '📅',
  soon:    '⏰ Скоро срок:',
  overdue: '⚠ Просрочена:',
};

export function TaskDetailPage() {
  const api = useApi();
  const { can } = useAuth();
  const canEdit = can('editor');
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [task, setTask]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [notice, setNotice]   = useState(location.state?.message || '');
  const [file, setFile]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(id)
      .then((data) => { if (active) setTask(data.task); })
      .catch((err)  => { if (active) setError(err); })
      .finally(()   => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, id]);

  async function reload() {
    const data = await api.get(id);
    setTask(data.task);
  }

  async function onUpload(event) {
    event.preventDefault();
    setUploading(true);
    setError(null);
    try {
      await api.upload(id, file);
      setFile(null);
      event.target.reset();
      await reload();
      setNotice('Файл прикреплён');
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(attachment) {
    setError(null);
    try {
      await api.download(task.id, attachment.id, attachment.originalName);
    } catch (err) {
      setError(err);
    }
  }

  async function onDeleteAttachment(attachmentId) {
    setPending(true);
    setError(null);
    try {
      await api.removeAttachment(id, attachmentId);
      await reload();
      setNotice('Вложение удалено');
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  async function onDeleteTask() {
    if (!task || !window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setPending(true);
    setError(null);
    try {
      await api.remove(id);
      navigate('/', { state: { message: `Задача «${task.title}» удалена` } });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  if (loading) {
    return (
      <section>
        <Link className="back-link" to="/">← К списку</Link>
        <div className="skeleton-list">
          {[1, 2].map((n) => <div key={n} className="skeleton-card" style={{ height: 120 }} />)}
        </div>
      </section>
    );
  }

  if (error?.status === 404 && !task) {
    return (
      <section>
        <Link className="back-link" to="/">← К списку</Link>
        <ErrorBanner error={error} />
      </section>
    );
  }

  if (!task) {
    return <section><ErrorBanner error={error} /></section>;
  }

  const severity = getDueSeverity(task.dueDate);

  return (
    <section>
      <Link className="back-link" to="/">← К списку</Link>
      <NoticeBanner message={notice} />
      <ErrorBanner error={error} />

      {/* ── Task card ── */}
      <article className="card" style={{ marginBottom: 18 }}>
        <div className="detail-header">
          <div className="detail-title">
            <h1 style={{ marginBottom: 6 }}>{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
        </div>

        <div className="detail-meta">
          {task.dueDate && (
            <div className={`detail-meta-row due-tag--${severity}`}>
              <span className="meta-icon">{DUE_LABEL[severity]}</span>
              <span>{formatDate(task.dueDate)}</span>
            </div>
          )}
          <div className="detail-meta-row">
            <span className="meta-icon">🕐</span>
            <span>Создана {formatDateTime(task.createdAt)}</span>
          </div>
          {task.createdAt !== task.updatedAt && (
            <div className="detail-meta-row">
              <span className="meta-icon">✏</span>
              <span>Изменена {formatDateTime(task.updatedAt)}</span>
            </div>
          )}
        </div>

        {task.description
          ? <div className="detail-description">{task.description}</div>
          : <p className="no-description">Описание не указано</p>}

        {canEdit && <div className="form-actions">
          <Link className="button button-primary" to={`/tasks/${task.id}/edit`}>
            ✏ Изменить
          </Link>
          <div className="form-actions-spacer" />
          <button
            className="button button-danger"
            type="button"
            disabled={pending}
            onClick={onDeleteTask}
          >
            {pending ? 'Удаление…' : '✕ Удалить задачу'}
          </button>
        </div>}
      </article>

      {/* ── Attachments ── */}
      <section className="card">
        <div className="section-head">
          <h2>Вложения</h2>
          {task.attachments.length > 0 && (
            <span className="attach-count-badge">{task.attachments.length}</span>
          )}
        </div>

        {task.attachments.length === 0
          ? <p className="muted">Файлов пока нет.</p>
          : (
            <ul className="attachment-list">
              {task.attachments.map((att) => (
                <li key={att.id} className="attachment-item">
                  <span className="file-icon">{fileIcon(att.mimeType)}</span>
                  <div className="attachment-info">
                    <button
                      className="attachment-name"
                      type="button"
                      title="Скачать файл"
                      onClick={() => onDownload(att)}
                    >
                      {att.originalName}
                    </button>
                    <p className="attachment-meta">
                      {formatFileSize(att.size)} · {formatDateTime(att.uploadedAt)}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      className="button button-sm button-danger"
                      type="button"
                      disabled={pending}
                      title="Удалить вложение"
                      onClick={() => onDeleteAttachment(att.id)}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        }

        {canEdit && <div className="upload-zone">
          <form className="upload-row" onSubmit={onUpload}>
            <label className="field">
              <span>Прикрепить файл (до 10 МБ)</span>
              <input
                type="file"
                name="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {error?.fields?.file && (
                <span className="field-error">⚠ {error.fields.file}</span>
              )}
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={uploading || pending}
            >
              {uploading ? 'Загрузка…' : '↑ Прикрепить'}
            </button>
          </form>
        </div>}
      </section>
    </section>
  );
}
