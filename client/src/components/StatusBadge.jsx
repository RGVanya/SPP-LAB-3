import { statusLabel } from '../constants';

const STATUS_ICONS = {
  new:         '○',
  in_progress: '◑',
  done:        '●',
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-icon">{STATUS_ICONS[status]}</span>
      {statusLabel(status)}
    </span>
  );
}
