const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://tasks:tasks@localhost:5432/tasks',
  uploadsDir: path.resolve(process.env.UPLOADS_DIR || path.join(rootDir, 'uploads')),
  clientDist: process.env.CLIENT_DIST ? path.resolve(process.env.CLIENT_DIST) : '',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024,

  logLevel: process.env.LOG_LEVEL || 'info',
  // Число прокси перед API (для корректного req.ip); 0 — доверяем только прямому подключению.
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),

  auth: {
    // Пустой секрет допустим только в разработке: сервер сгенерирует случайный при старте.
    jwtSecret: process.env.JWT_SECRET || '',
    accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL) || 15 * 60,
    refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL) || 7 * 24 * 60 * 60,
    resetTtlSeconds: Number(process.env.RESET_TOKEN_TTL) || 30 * 60,
    maxSessions: Number(process.env.MAX_SESSIONS) || 5,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },

  limits: {
    windowSeconds: 15 * 60,
    lockSeconds: Number(process.env.LOCK_SECONDS) || 15 * 60,
    loginPerEmail: 5,
    loginPerIp: 20,
    forgotPerIp: 5,
  },

  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 1025,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.MAIL_FROM || 'Менеджер задач <no-reply@tasks.local>',
  },

  seed: {
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    adminName: process.env.ADMIN_NAME || 'Администратор',
    // Если задан — создаются demo editor@example.com и viewer@example.com с этим паролем.
    demoPassword: process.env.DEMO_USERS_PASSWORD || '',
  },
};
