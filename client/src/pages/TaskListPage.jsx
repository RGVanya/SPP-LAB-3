import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useApi } from '../api/context';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner, NoticeBanner } from '../components/Banners';
import { StatusBadge } from '../components/StatusBadge';
import { STATUS_OPTIONS } from '../constants';
import { formatDate } from '../format';

const SORT_OPTIONS = [
  { value: 'due',     label: 'По сроку' },
  { value: 'created', label: 'По дате создания' },
  { value: 'title',   label: 'По названию' },
  { value: 'status',  label: 'По статусу' },
];

const STATUS_ORDER = { new: 0, in_progress: 1, done: 2 };

function getDueSeverity(dueDate) {
  if (!dueDate) return 'none';
  const due  = new Date(dueDate);
  const now  = new Date(); now.setHours(0, 0, 0, 0);
  if (due < now) return 'overdue';
  const soon = new Date(now); soon.setDate(soon.getDate() + 3);
  if (due <= soon) return 'soon';
  return 'ok';
}

export function TaskListPage() {
  const api = useApi();
  const { can } = useAuth();
  const canEdit = can('editor');
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [sort, setSort] = useState('due');
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message || '');
  const [pendingId, setPendingId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    // Всегда грузим все задачи — фильтр и сортировка на клиенте.
    api.list()
      .then((data) => { if (active) setAllTasks(data.tasks); })
      .catch((err)  => { if (active) setError(err); })
      .finally(()   => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  const stats = useMemo(() => ({
    total:      allTasks.length,
    done:       allTasks.filter((t) => t.status === 'done').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
    newCount:   allTasks.filter((t) => t.status === 'new').length,
  }), [allTasks]);

  const tasks = useMemo(() => {
    let result = status ? allTasks.filter((t) => t.status === status) : allTasks;
    return [...result].sort((a, b) => {
      if (sort === 'due') {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate)  return -1;
        if (b.dueDate)  return  1;
        return a.createdAt.localeCompare(b.createdAt);
      }
      if (sort === 'created') return a.createdAt.localeCompare(b.createdAt);
      if (sort === 'title')   return a.title.localeCompare(b.title, 'ru');
      if (sort === 'status')  return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      return 0;
    });
  }, [allTasks, status, sort]);

  function onStatusChange(e) {
    const v = e.target.value;
    setParams(v ? { status: v } : {});
  }

  async function onDelete(task) {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setPendingId(task.id);
    setError(null);
    try {
      await api.remove(task.id);
      setAllTasks((cur) => cur.filter((t) => t.id !== task.id));
      setNotice(`Задача «${task.title}» удалена`);
    } catch (err) {
      setError(err);
    } finally {
      setPendingId('');
    }
  }

  const donePercent = stats.total > 0
    ? Math.round((stats.done / stats.total) * 100)
    : 0;

  return (
    <section>
      <div className="page-head">
        <div className="page-head-title">
          <h1>Задачи</h1>
          {!loading && stats.total > 0 && (
            <p className="page-subtitle">{stats.total} задач · {donePercent}% выполнено</p>
          )}
        </div>
        <div className="controls-row">
          <label className="field filter-field">
            <span>Статус</span>
            <select value={status} onChange={onStatusChange}>
              <option value="">Все</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="field filter-field">
            <span>Сортировка</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!loading && stats.total > 0 && (
        <div className="stats-bar">
          <div className="stats-items">
            <div className="stat-item">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-label">всего</span>
            </div>
            <div className="stat-item stat-item--new">
              <span className="stat-number">{stats.newCount}</span>
              <span className="stat-label">новых</span>
            </div>
            <div className="stat-item stat-item--progress">
              <span className="stat-number">{stats.inProgress}</span>
              <span className="stat-label">в работе</span>
            </div>
            <div className="stat-item stat-item--done">
              <span className="stat-number">{stats.done}</span>
              <span className="stat-label">готово</span>
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${donePercent}%` }} />
            </div>
            <span className="progress-label">{donePercent}%</span>
          </div>
        </div>
      )}

      <NoticeBanner message={notice} />
      <ErrorBanner error={error} />

      {loading && (
        <div className="skeleton-list">
          {[1, 2, 3].map((n) => <div key={n} className="skeleton-card" />)}
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2>Задач пока нет</h2>
          <p>
            {status
              ? 'В этой категории нет задач. Выберите другой фильтр.'
              : canEdit
              ? 'Создайте первую задачу, чтобы начать работу.'
              : 'Здесь появятся задачи, когда редакторы их создадут.'}
          </p>
          {!status && canEdit && (
            <Link className="button button-primary" to="/tasks/new">
              <span>+</span> Создать задачу
            </Link>
          )}
        </div>
      )}

      <ul className="task-list">
        {tasks.map((task) => {
          const severity = getDueSeverity(task.dueDate);
          const dueSeverityIcon = severity === 'overdue'
            ? '⚠ Просрочена'
            : severity === 'soon'
            ? '⏰ Скоро срок'
            : '📅';

          return (
            <li
              key={task.id}
              className={`task-card task-card-status-${task.status} severity-${severity}`}
            >
              <div className="task-card-inner">
                <div className="task-card-header">
                  <Link className="task-card-title-link" to={`/tasks/${task.id}`}>
                    {task.title}
                  </Link>
                  <StatusBadge status={task.status} />
                </div>

                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}

                <div className="task-card-footer">
                  <span className={`due-tag due-tag--${severity}`}>
                    {dueSeverityIcon} {formatDate(task.dueDate)}
                  </span>
                  {task.attachments?.length > 0 && (
                    <span className="attach-count">
                      📎 {task.attachments.length}
                    </span>
                  )}
                </div>
              </div>

              <div className="task-card-actions">
                <Link className="button button-sm" to={`/tasks/${task.id}`}>
                  Открыть
                </Link>
                {canEdit && (
                  <button
                    className="button button-sm button-danger"
                    type="button"
                    disabled={pendingId === task.id}
                    title="Удалить задачу"
                    onClick={() => onDelete(task)}
                  >
                    {pendingId === task.id ? '…' : '✕'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
