const { methodNotAllowed: methodNotAllowedError } = require('../errors/httpErrors');

/**
 * Последний обработчик router.route(...): 405 + Allow для неподдерживаемых методов,
 * 204 + Allow для OPTIONS. HEAD поддерживается автоматически там, где есть GET.
 */
function methodNotAllowed(methods) {
  const allowed = methods.includes('GET') ? ['GET', 'HEAD', ...methods.filter((m) => m !== 'GET')] : methods;
  return function rejectMethod(req, res, next) {
    res.set('Allow', allowed.join(', '));
    if (req.method === 'OPTIONS') return res.status(204).end();
    next(methodNotAllowedError(allowed));
  };
}

module.exports = { methodNotAllowed };
