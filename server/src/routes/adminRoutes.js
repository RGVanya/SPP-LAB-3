const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { handleValidation } = require('../middlewares/validate');
const { requireJson } = require('../middlewares/requireContentType');
const { requireRole } = require('../middlewares/requireRole');
const { methodNotAllowed } = require('../middlewares/methodNotAllowed');
const { roleRules } = require('../middlewares/authValidators');

function createAdminRouter({ adminController, authenticate }) {
  const router = express.Router();
  const c = adminController;

  router.use(authenticate, requireRole('admin'));

  router.route('/users').get(asyncHandler(c.listUsers)).all(methodNotAllowed(['GET']));
  router.route('/users/:userId')
    .patch(requireJson, roleRules, handleValidation, asyncHandler(c.changeRole))
    .all(methodNotAllowed(['PATCH']));
  router.route('/sessions').get(asyncHandler(c.listSessions)).all(methodNotAllowed(['GET']));
  router.route('/sessions/:sessionId')
    .delete(asyncHandler(c.revokeSession))
    .all(methodNotAllowed(['DELETE']));

  return router;
}

module.exports = { createAdminRouter };
