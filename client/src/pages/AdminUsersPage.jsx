import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_OPTIONS } from '../auth/roles';
import { ErrorBanner, NoticeBanner } from '../components/Banners';
import { RoleBadge } from '../components/RoleBadge';
import { SessionCard } from '../components/SessionCard';
import { formatDateTime } from '../format';

const TABS = [
  { id: 'users', label: 'Пользователи' },
  { id: 'sessions', label: 'Активные сеансы' },
];

export function AdminUsersPage() {
  const { adminApi, user: me } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [u, s] = await Promise.all([adminApi.users(), adminApi.sessions()]);
    setUsers(u.users);
    setSessions(s.sessions);
  }, [adminApi]);

  useEffect(() => {
    load().catch(setError).finally(() => setLoading(false));
  }, [load]);

  async function run(action, message) {
    setPending(true);
    setError(null);
    try {
      await action();
      await load();
      setNotice(message);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  function changeRole(user, role) {
    if (role === user.role) return;
    run(() => adminApi.changeRole(user.id, role), `${user.name}: роль изменена`);
  }

  const counts = ROLE_OPTIONS.map((r) => ({ ...r, count: users.filter((u) => u.role === r.value).length }));

  return (
    <section>
      <div className="page-head">
        <div className="page-head-title">
          <h1>Администрирование</h1>
          <p className="page-subtitle">Роли пользователей и контроль активных подключений.</p>
        </div>
      </div>

      {!loading && (
        <div className="stats-bar">
          <div className="stats-items">
            <div className="stat-item">
              <span className="stat-number">{users.length}</span>
              <span className="stat-label">пользователей</span>
            </div>
            {counts.map((r) => (
              <div key={r.value} className={`stat-item stat-item--${r.value}`}>
                <span className="stat-number">{r.count}</span>
                <span className="stat-label">{r.label}</span>
              </div>
            ))}
            <div className="stat-item">
              <span className="stat-number">{sessions.length}</span>
              <span className="stat-label">сеансов</span>
            </div>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <NoticeBanner message={notice} />
      <ErrorBanner error={error} />

      {loading && <div className="skeleton-list">{[1, 2, 3].map((n) => <div key={n} className="skeleton-card" />)}</div>}

      {!loading && tab === 'users' && (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>Сеансы</th>
                <th>Зарегистрирован</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{user.name}</strong>{user.id === me.id && <span className="muted"> (вы)</span>}
                        <div className="meta">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {user.id === me.id ? (
                      <RoleBadge role={user.role} />
                    ) : (
                      <select
                        className="role-select"
                        value={user.role}
                        disabled={pending}
                        onChange={(event) => changeRole(user, event.target.value)}
                        aria-label={`Роль пользователя ${user.name}`}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    <span className={`session-count${user.activeSessions ? ' session-count--on' : ''}`}>
                      {user.activeSessions}
                    </span>
                  </td>
                  <td className="meta">{formatDateTime(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'sessions' && (
        <ul className="session-list">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              showUser
              pending={pending}
              onRevoke={(s) => run(() => adminApi.revokeSession(s.id), `Сеанс пользователя ${s.user.name} завершён`)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
