export class AdminApi {
  constructor(http) {
    this.http = http;
  }

  users() {
    return this.http.request('/admin/users');
  }

  changeRole(userId, role) {
    return this.http.request(`/admin/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: { role } });
  }

  sessions() {
    return this.http.request('/admin/sessions');
  }

  revokeSession(id) {
    return this.http.request(`/admin/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
