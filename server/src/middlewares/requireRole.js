const { hasRole } = require('../models/User');
const { forbidden } = require('../errors/httpErrors');

// Пропускает пользователя с ролью не ниже требуемой (viewer < editor < admin).
function requireRole(role) {
  return function checkRole(req, res, next) {
    if (!hasRole(req.user?.role, role)) return next(forbidden(role));
    next();
  };
}

module.exports = { requireRole };
