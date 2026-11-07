const { body, query } = require('express-validator');
const { STATUS_LIST } = require('../models/Task');

const taskRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Название задачи обязательно')
    .isLength({ max: 200 })
    .withMessage('Название не должно превышать 200 символов'),
  body('description')
    .optional({ values: 'null' })
    .trim()
    .isString()
    .withMessage('Описание должно быть строкой')
    .isLength({ max: 2000 })
    .withMessage('Описание не должно превышать 2000 символов'),
  body('status')
    .isIn(STATUS_LIST)
    .withMessage('Некорректный статус'),
  body('dueDate')
    .optional({ values: 'falsy' })
    .isISO8601({ strict: true })
    .withMessage('Некорректная дата завершения'),
];

const listQueryRules = [
  query('status')
    .optional({ values: 'falsy' })
    .isIn(STATUS_LIST)
    .withMessage('Некорректный статус'),
];

module.exports = { taskRules, listQueryRules };
