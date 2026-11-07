import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner, NoticeBanner } from '../components/Banners';
import { SessionCard } from '../components/SessionCard';

export function SessionsPage() {
  const { authApi } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const data = await authApi.sessions();
    setSessions(data.sessions);
  }, [authApi]);

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

  const others = sessions.filter((s) => !s.current).length;

  return (
    <section>
      <div className="page-head">
        <div className="page-head-title">
          <h1>Мои сеансы</h1>
          <p className="page-subtitle">
            Устройства, на которых выполнен вход. Не узнаёте устройство — завершите сеанс и смените пароль.
          </p>
        </div>
        {others > 0 && (
          <button
            className="button button-danger"
            type="button"
            disabled={pending}
            onClick={() => run(() => authApi.revokeOtherSessions(), 'Все другие сеансы завершены')}
          >
            Завершить все другие ({others})
          </button>
        )}
      </div>

      <NoticeBanner message={notice} />
      <ErrorBanner error={error} />

      {loading ? (
        <div className="skeleton-list">{[1, 2].map((n) => <div key={n} className="skeleton-card" />)}</div>
      ) : (
        <ul className="session-list">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              pending={pending}
              onRevoke={(s) => run(() => authApi.revokeSession(s.id), 'Сеанс завершён')}
            />
          ))}
        </ul>
      )}
      <p className="meta section-gap">
        Одновременно может быть активно не более 5 сеансов — при входе с шестого устройства самый старый
        завершается автоматически.
      </p>
    </section>
  );
}
