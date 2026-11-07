export const ROLE_LABELS = {
  viewer: 'Наблюдатель',
  editor: 'Редактор',
  admin: 'Администратор',
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

const ROLE_RANK = { viewer: 1, editor: 2, admin: 3 };

// Права вложены: viewer < editor < admin — так же, как на сервере.
export function hasRole(userRole, required) {
  return (ROLE_RANK[userRole] || 0) >= ROLE_RANK[required];
}
