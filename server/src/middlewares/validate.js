const { validationResult } = require('express-validator');
const { validationError } = require('../errors/httpErrors');

function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const fields = {};
  for (const error of result.array()) {
    const key = error.path || 'form';
    if (!fields[key]) fields[key] = error.msg;
  }

  // JSON разобран, но значения нарушают правила — 422 Unprocessable Content (RFC 9110).
  next(validationError(fields));
}

module.exports = { handleValidation };
