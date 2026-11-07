const { unsupportedMediaType } = require('../errors/httpErrors');

// 415 Unsupported Media Type, если тело запроса не того формата, который понимает ресурс.
function requireContentType(type) {
  return function checkContentType(req, res, next) {
    if (!req.is(type)) return next(unsupportedMediaType(type));
    next();
  };
}

const requireJson = requireContentType('application/json');
const requireMultipart = requireContentType('multipart/form-data');

module.exports = { requireContentType, requireJson, requireMultipart };
