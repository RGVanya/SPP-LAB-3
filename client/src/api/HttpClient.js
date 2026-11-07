import { ApiError } from './ApiError';

/**
 * HTTP-клиент с временными ключами.
 * Ключ доступа живёт только в памяти; ключ обновления — в HttpOnly-cookie, JS его не видит.
 * На 401 клиент один раз обновляет ключ и повторяет запрос — пользователь ничего не замечает.
 */
export class HttpClient {
  #accessToken = null;
  #refreshing = null;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.onSession = () => {};
    this.onAuthLost = () => {};
  }

  setSession(data) {
    this.#accessToken = data.accessToken;
    this.onSession(data);
    return data;
  }

  clearSession() {
    this.#accessToken = null;
  }

  /**
   * Обмен ключа обновления: один запрос на вкладку (single-flight) и Web Locks между вкладками —
   * иначе две вкладки предъявят один ключ, и сервер примет второй обмен за кражу.
   */
  refresh() {
    if (!this.#refreshing) {
      const run = () => this.request('/auth/refresh', { method: 'POST', auth: false });
      const locked = navigator.locks?.request
        ? navigator.locks.request('auth-refresh', run)
        : run();
      this.#refreshing = locked
        .then((data) => this.setSession(data))
        .finally(() => { this.#refreshing = null; });
    }
    return this.#refreshing;
  }

  async request(path, { method = 'GET', body, formData, auth = true, raw = false, retry = true } = {}) {
    const headers = {};
    let payload;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (auth && this.#accessToken) headers.Authorization = `Bearer ${this.#accessToken}`;

    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: payload,
        credentials: 'same-origin',
      });
    } catch {
      throw new ApiError('Нет соединения с сервером', 0);
    }

    if (response.ok) {
      if (raw) return response;
      if (response.status === 204) return null;
      return response.json();
    }

    const error = await ApiError.fromResponse(response);
    if (error.status === 401 && auth && retry) {
      try {
        await this.refresh();
      } catch {
        this.clearSession();
        this.onAuthLost();
        throw error;
      }
      return this.request(path, { method, body, formData, auth, raw, retry: false });
    }
    throw error;
  }
}
