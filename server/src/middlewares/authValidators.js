const { body } = require('express-validator');
const { ROLE_LIST } = require('../models/User');

const email = body('email')
  .isString().withMessage('Укажите e-mail')
  .trim()
  .isLength({ min: 3, max: 254 }).withMessage('E-mail должен содержать от 3 до 254 символов')
  .bail()
  .isEmail().withMessage('Некорректный e-mail');

const newPassword = (field = 'password') => body(field)
  .isString().withMessage('Укажите пароль')
  .isLength({ min: 8, max: 128 }).withMessage('Пароль должен содержать от 8 до 128 символов');

const registerRules = [
  email,
  body('name')
    .isString().withMessage('Укажите имя')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Имя должно содержать от 1 до 100 символов'),
  newPassword(),
];

const loginRules = [
  email,
  body('password').isString().notEmpty().withMessage('Укажите пароль'),
];

const forgotPasswordRules = [email];

const resetPasswordRules = [
  body('token').isString().notEmpty().withMessage('Ссылка восстановления повреждена'),
  newPassword(),
];

const roleRules = [
  body('role').isIn(ROLE_LIST).withMessage('Роль должна быть одной из: viewer, editor, admin'),
];

module.exports = { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, roleRules };
