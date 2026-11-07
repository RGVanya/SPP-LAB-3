import { ROLE_LABELS } from '../auth/roles';

export function RoleBadge({ role }) {
  return <span className={`role-badge role-${role}`}>{ROLE_LABELS[role] || role}</span>;
}
