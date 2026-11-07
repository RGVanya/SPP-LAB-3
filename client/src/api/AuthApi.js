export class AuthApi {
  constructor(http) {
    this.http = http;
  }

  async login(email, password) {
    const data = await this.http.request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    return this.http.setSession(data);
  }

  async register({ name, email, password }) {
    const data = await this.http.request('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      auth: false,
    });
    return this.http.setSession(data);
  }

  async logout() {
    try {
      await this.http.request('/auth/logout', { method: 'POST', auth: false });
    } finally {
      this.http.clearSession();
    }
  }

  forgotPassword(email) {
    return this.http.request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
  }

  resetPassword(token, password) {
    return this.http.request('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false });
  }

  sessions() {
    return this.http.request('/auth/sessions');
  }

  revokeSession(id) {
    return this.http.request(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  revokeOtherSessions() {
    return this.http.request('/auth/sessions', { method: 'DELETE' });
  }
}
