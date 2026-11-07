const AppError = require('./AppError');

const REALM = 'Bearer realm="tasks"';

// RFC 6750 §3: error_description — только ASCII, поэтому описание в заголовке на английском.
function bearerChallenge(error, description) {
  if (!error) return REALM;
  return `${REALM}, error="${error}", error_description="${description}"`;
}

function unauthorized(detail = 'Требуется вход в систему', { type = 'unauthorized', extensions } = {}) {
  return new AppError(detail, 401, null, {
    type,
    headers: { 'WWW-Authenticate': REALM },
    extensions,
  });
}

function invalidToken(description = 'The access token is invalid') {
  return new AppError('Сеанс истёк или недействителен. Войдите снова.', 401, null, {
    type: 'invalid-token',
    headers: { 'WWW-Authenticate': bearerChallenge('invalid_token', description) },
  });
}

function invalidRefreshToken(detail = 'Сеанс истёк. Войдите снова.') {
  return unauthorized(detail, { type: 'invalid-refresh-token' });
}

function forbidden(requiredRole) {
  return new AppError('Недостаточно прав для этого действия', 403, null, {
    type: 'insufficient-role',
    headers: { 'WWW-Authenticate': bearerChallenge('insufficient_scope', `Requires role ${requiredRole}`) },
    extensions: { requiredRole },
  });
}

function notFound(detail = 'Ресурс не найден') {
  return new AppError(detail, 404, null, { type: 'not-found' });
}

function methodNotAllowed(allowed) {
  return new AppError('Метод не поддерживается для этого адреса', 405, null, {
    type: 'method-not-allowed',
    headers: { Allow: allowed.join(', ') },
  });
}

function conflict(detail, type = 'conflict') {
  return new AppError(detail, 409, null, { type });
}

function unsupportedMediaType(expected) {
  return new AppError(`Тело запроса должно быть в формате ${expected}`, 415, null, {
    type: 'unsupported-media-type',
  });
}

function validationError(fields, detail = 'Проверьте введённые данные', type = 'validation-error') {
  return new AppError(detail, 422, fields, { type });
}

function tooManyRequests(retryAfter, detail) {
  const seconds = Math.max(1, Math.ceil(retryAfter));
  const minutes = Math.ceil(seconds / 60);
  return new AppError(
    detail || `Слишком много попыток. Повторите через ${minutes} мин.`,
    429,
    null,
    {
      type: 'too-many-attempts',
      headers: { 'Retry-After': String(seconds) },
      extensions: { retryAfter: seconds },
    },
  );
}

module.exports = {
  unauthorized,
  invalidToken,
  invalidRefreshToken,
  forbidden,
  notFound,
  methodNotAllowed,
  conflict,
  unsupportedMediaType,
  validationError,
  tooManyRequests,
};
