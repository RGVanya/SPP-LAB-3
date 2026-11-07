const http = require('http');
const multer = require('multer');
const AppError = require('../errors/AppError');

const DEFAULT_TYPES = {
  400: 'malformed-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  405: 'method-not-allowed',
  409: 'conflict',
  413: 'payload-too-large',
  415: 'unsupported-media-type',
  422: 'validation-error',
  429: 'too-many-attempts',
  500: 'internal',
  503: 'service-unavailable',
};

// Фразы статусов по RFC 9110 (в http.STATUS_CODES Node.js остались названия из RFC 7231).
const RFC9110_TITLES = {
  413: 'Content Too Large',
  422: 'Unprocessable Content',
};

// Ошибки драйвера pg, означающие, что БД недоступна, а не что запрос плохой.
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
  '57P01', '57P02', '57P03', '08000', '08001', '08003', '08006',
]);

const MALFORMED_MULTIPART = /^(Multipart|Unexpected end of form|Malformed part header)/;

/**
 * Ответ об ошибке в формате RFC 9457 (application/problem+json).
 */
function sendProblem(req, res, { status, detail, type, fields, headers, extensions }) {
  for (const [name, value] of Object.entries(headers || {})) res.set(name, value);
  const body = {
    type: `/problems/${type || DEFAULT_TYPES[status] || 'error'}`,
    title: RFC9110_TITLES[status] || http.STATUS_CODES[status],
    status,
    detail,
    instance: req.originalUrl.split('?')[0],
    requestId: req.id,
    ...extensions,
  };
  if (fields) body.fields = fields;
  res.status(status).type('application/problem+json').json(body);
}

function notFoundHandler(req, res) {
  sendProblem(req, res, { status: 404, detail: 'Ресурс не найден' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return sendProblem(req, res, {
      status: err.statusCode,
      detail: err.message,
      type: err.type,
      fields: err.fields,
      headers: err.headers,
      extensions: err.extensions,
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendProblem(req, res, {
        status: 413,
        detail: 'Файл больше 10 МБ',
        fields: { file: 'Файл больше 10 МБ' },
      });
    }
    return sendProblem(req, res, {
      status: 422,
      detail: 'Не удалось принять файл',
      fields: { file: 'Не удалось принять файл' },
    });
  }

  // Ошибки разбора тела от express.json (body-parser).
  if (err.type === 'entity.parse.failed') {
    return sendProblem(req, res, { status: 400, detail: 'Некорректный JSON в теле запроса' });
  }
  if (err.type === 'entity.too.large') {
    return sendProblem(req, res, { status: 413, detail: 'Тело запроса больше 1 МБ' });
  }
  if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
    return sendProblem(req, res, { status: 415, detail: 'Неподдерживаемая кодировка тела запроса' });
  }
  if (MALFORMED_MULTIPART.test(err.message || '')) {
    return sendProblem(req, res, { status: 400, detail: 'Некорректное тело multipart/form-data' });
  }
  if (err.expose && err.status >= 400 && err.status < 500) {
    return sendProblem(req, res, { status: err.status, detail: 'Некорректный запрос' });
  }

  if (DB_UNAVAILABLE_CODES.has(err.code)) {
    req.log.error({ err }, 'База данных недоступна');
    return sendProblem(req, res, {
      status: 503,
      detail: 'Сервис временно недоступен. Повторите попытку позже.',
      headers: { 'Retry-After': '5' },
    });
  }

  req.log.error({ err }, 'Необработанная ошибка');
  sendProblem(req, res, { status: 500, detail: 'Внутренняя ошибка сервера' });
}

module.exports = { notFoundHandler, errorHandler, sendProblem };
