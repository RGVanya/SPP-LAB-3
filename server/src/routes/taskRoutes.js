const express = require('express');
const { taskRules, listQueryRules } = require('../middlewares/validators');
const { handleValidation } = require('../middlewares/validate');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { requireRole } = require('../middlewares/requireRole');
const { requireJson, requireMultipart } = require('../middlewares/requireContentType');
const { methodNotAllowed } = require('../middlewares/methodNotAllowed');

function createTaskRouter({ taskController, attachmentController, upload, taskService, authenticate }) {
  const router = express.Router();
  const viewer = requireRole('viewer');
  const editor = requireRole('editor');

  const ensureTask = asyncHandler(async (req, res, next) => {
    await taskService.getById(req.params.id);
    next();
  });

  router.use(authenticate);

  router.route('/')
    .get(viewer, listQueryRules, handleValidation, asyncHandler(taskController.list))
    .post(editor, requireJson, taskRules, handleValidation, asyncHandler(taskController.create))
    .all(methodNotAllowed(['GET', 'POST']));

  router.route('/:id')
    .get(viewer, asyncHandler(taskController.show))
    .put(editor, requireJson, taskRules, handleValidation, asyncHandler(taskController.update))
    .delete(editor, asyncHandler(taskController.destroy))
    .all(methodNotAllowed(['GET', 'PUT', 'DELETE']));

  router.route('/:id/attachments')
    .post(
      editor,
      requireMultipart,
      ensureTask,
      upload.single('file'),
      asyncHandler(attachmentController.create),
    )
    .all(methodNotAllowed(['POST']));

  router.route('/:id/attachments/:attachmentId')
    .delete(editor, asyncHandler(attachmentController.destroy))
    .all(methodNotAllowed(['DELETE']));

  router.route('/:id/attachments/:attachmentId/download')
    .get(viewer, asyncHandler(attachmentController.download))
    .all(methodNotAllowed(['GET']));

  return router;
}

module.exports = { createTaskRouter };
