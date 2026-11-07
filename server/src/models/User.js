const ROLE = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin',
};

const ROLE_LIST = Object.values(ROLE);

// Права вложены: каждая следующая роль умеет всё, что предыдущая.
const ROLE_RANK = {
  [ROLE.VIEWER]: 1,
  [ROLE.EDITOR]: 2,
  [ROLE.ADMIN]: 3,
};

function hasRole(userRole, requiredRole) {
  return (ROLE_RANK[userRole] || 0) >= ROLE_RANK[requiredRole];
}

class User {
  constructor({ id, email, name, role, passwordHash, createdAt, activeSessions }) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.role = role;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
    this.activeSessions = activeSessions;
  }

  // Хеш пароля клиенту не отдаём никогда.
  toJSON() {
    const json = {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      createdAt: this.createdAt,
    };
    if (this.activeSessions !== undefined) json.activeSessions = this.activeSessions;
    return json;
  }
}

module.exports = { User, ROLE, ROLE_LIST, ROLE_RANK, hasRole };
