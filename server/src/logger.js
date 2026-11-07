const crypto = require('crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

// Секреты не должны попасть в журнал ни при каких обстоятельствах.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
];

function createLogger({ level = 'info' } = {}, destination = undefined) {
  return pino(
    {
      level,
      base: { service: 'task-manager-api' },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    },
    destination,
  );
}

function createHttpLogger(logger) {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
        ? incoming
        : crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    // Статику SPA не журналируем: интересны только обращения к API.
    autoLogging: { ignore: (req) => !req.url.startsWith('/api') },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl} → ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${req.originalUrl} → ${res.statusCode}`,
    // reqId — верхнеуровневое поле и в записи запроса, и в событиях через req.log.
    customProps: (req) => ({
      reqId: req.id,
      ...(req.user && { userId: req.user.id, role: req.user.role }),
    }),
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        ip: req.raw?.ip ?? req.remoteAddress,
        userAgent: req.headers['user-agent'],
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

/**
 * Запись события безопасности: отдельная строка журнала с полем `event`.
 */
function securityEvent(log, event, data = {}, level = 'info') {
  log[level]({ event, ...data }, `security: ${event}`);
}

module.exports = { createLogger, createHttpLogger, securityEvent };
