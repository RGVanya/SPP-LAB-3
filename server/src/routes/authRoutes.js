const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { handleValidation } = require('../middlewares/validate');
const { requireJson } = require('../middlewares/requireContentType');
const { methodNotAllowed } = require('../middlewares/methodNotAllowed');
const {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require('../middlewares/authValidators');

function createAuthRouter({ authController, authenticate }) {
  const router = express.Router();
  const c = authController;

  // Публичные маршруты.
  router.route('/register')
    .post(requireJson, registerRules, handleValidation, asyncHandler(c.register))
    .all(methodNotAllowed(['POST']));
  router.route('/login')
    .post(requireJson, loginRules, handleValidation, asyncHandler(c.login))
    .all(methodNotAllowed(['POST']));
  router.route('/refresh').post(asyncHandler(c.refresh)).all(methodNotAllowed(['POST']));
  router.route('/logout').post(asyncHandler(c.logout)).all(methodNotAllowed(['POST']));
  router.route('/forgot-password')
    .post(requireJson, forgotPasswordRules, handleValidation, asyncHandler(c.forgotPassword))
    .all(methodNotAllowed(['POST']));
  router.route('/reset-password')
    .post(requireJson, resetPasswordRules, handleValidation, asyncHandler(c.resetPassword))
    .all(methodNotAllowed(['POST']));

  // Маршруты, требующие ключа доступа.
  router.route('/me').get(authenticate, asyncHandler(c.me)).all(methodNotAllowed(['GET']));
  router.route('/sessions')
    .get(authenticate, asyncHandler(c.listSessions))
    .delete(authenticate, asyncHandler(c.revokeOtherSessions))
    .all(methodNotAllowed(['GET', 'DELETE']));
  router.route('/sessions/:sessionId')
    .delete(authenticate, asyncHandler(c.revokeSession))
    .all(methodNotAllowed(['DELETE']));

  return router;
}

module.exports = { createAuthRouter };
