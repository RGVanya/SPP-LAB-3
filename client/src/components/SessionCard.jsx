import { describeUserAgent, formatDateTime, formatRelative } from '../format';
import { RoleBadge } from './RoleBadge';

export function SessionCard({ session, onRevoke, pending, showUser = false }) {
  const device = describeUserAgent(session.userAgent);
  return (
    <li className={`session-card${session.current ? ' session-card--current' : ''}`}>
      <span className="session-icon" aria-hidden="true">{device.icon}</span>
      <div className="session-info">
        <div className="session-title">
          <strong>{device.label}</strong>
          {session.current && <span className="badge badge-done">Этот сеанс</span>}
        </div>
        {showUser && session.user && (
          <div className="session-user">
            {session.user.name} · {session.user.email} <RoleBadge role={session.user.role} />
          </div>
        )}
        <p className="session-meta">
          IP {session.ip || '—'} · вход {formatDateTime(session.createdAt)} ·
          активность {formatRelative(session.lastUsedAt)}
        </p>
      </div>
      {!session.current && (
        <button
          className="button button-sm button-danger"
          type="button"
          disabled={pending}
          onClick={() => onRevoke(session)}
        >
          Завершить
        </button>
      )}
    </li>
  );
}
