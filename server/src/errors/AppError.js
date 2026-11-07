// Ожидаемая ошибка приложения: уходит клиенту как application/problem+json (RFC 9457).
// type — слаг из каталога /problems/<type>, headers — доп. заголовки ответа
// (WWW-Authenticate, Allow, Retry-After), extensions — доп. поля тела.
class AppError extends Error {
  constructor(message, statusCode = 400, fields = null, { type, headers, extensions } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.fields = fields;
    this.type = type;
    this.headers = headers || {};
    this.extensions = extensions || {};
  }
}

module.exports = AppError;
