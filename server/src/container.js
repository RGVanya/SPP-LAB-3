const { TaskRepository } = require('./repositories/TaskRepository');
const { AttachmentRepository } = require('./repositories/AttachmentRepository');
const { FileStorage } = require('./services/FileStorage');
const { TaskService } = require('./services/TaskService');
const { AttachmentService } = require('./services/AttachmentService');
const { TaskController } = require('./controllers/TaskController');
const { AttachmentController } = require('./controllers/AttachmentController');
const { createUpload } = require('./middlewares/upload');
const { createAuthenticate } = require('./middlewares/authenticate');
const { UserRepository } = require('./repositories/UserRepository');
const { SessionRepository } = require('./repositories/SessionRepository');
const { RateLimitRepository } = require('./repositories/RateLimitRepository');
const { PasswordResetRepository } = require('./repositories/PasswordResetRepository');
const { PasswordHasher } = require('./services/PasswordHasher');
const { TokenService } = require('./services/TokenService');
const { LoginThrottle } = require('./services/LoginThrottle');
const { AuthService } = require('./services/AuthService');
const { UserService } = require('./services/UserService');
const { SessionService } = require('./services/SessionService');
const { SmtpMailer } = require('./services/Mailer');
const { AuthController } = require('./controllers/AuthController');
const { AdminController } = require('./controllers/AdminController');

function createContainer({ pool, config, mailer = new SmtpMailer(config.smtp) }) {
  const taskRepository = new TaskRepository(pool);
  const attachmentRepository = new AttachmentRepository(pool);
  const fileStorage = new FileStorage(config.uploadsDir);
  const taskService = new TaskService({ taskRepository, attachmentRepository, fileStorage });
  const attachmentService = new AttachmentService({
    taskRepository,
    attachmentRepository,
    fileStorage,
  });

  const userRepository = new UserRepository(pool);
  const sessionRepository = new SessionRepository(pool);
  const passwordHasher = new PasswordHasher();
  const tokenService = new TokenService(config.auth);
  const loginThrottle = new LoginThrottle({
    rateLimitRepository: new RateLimitRepository(pool),
    limits: config.limits,
  });
  const authService = new AuthService({
    userRepository,
    sessionRepository,
    passwordResetRepository: new PasswordResetRepository(pool),
    passwordHasher,
    tokenService,
    loginThrottle,
    mailer,
    config,
  });
  const userService = new UserService({ userRepository, passwordHasher });
  const sessionService = new SessionService({ sessionRepository });

  return {
    pool,
    taskService,
    userService,
    userRepository,
    passwordHasher,
    taskController: new TaskController(taskService),
    attachmentController: new AttachmentController(attachmentService),
    authController: new AuthController({ authService, sessionService, config }),
    adminController: new AdminController({ userService, sessionService }),
    authenticate: createAuthenticate({ tokenService, sessionRepository }),
    upload: createUpload(config),
  };
}

module.exports = { createContainer };
