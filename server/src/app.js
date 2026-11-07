const fs = require('fs');
const path = require('path');
const express = require('express');
const { createTaskRouter } = require('./routes/taskRoutes');
const { createAuthRouter } = require('./routes/authRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { asyncHandler } = require('./middlewares/asyncHandler');
const { methodNotAllowed } = require('./middlewares/methodNotAllowed');
const { createHttpLogger } = require('./logger');

function createApp(deps) {
  const { config, logger, pool } = deps;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(createHttpLogger(logger));
  app.use(express.json({ limit: '1mb' }));

  // Публичная проверка живости: 503, если БД недоступна.
  app.route('/api/health')
    .get(asyncHandler(async (req, res) => {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    }))
    .all(methodNotAllowed(['GET']));

  app.use('/api/auth', createAuthRouter(deps));
  app.use('/api/admin', createAdminRouter(deps));
  app.use('/api/tasks', createTaskRouter(deps));

  if (config.clientDist && fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(config.clientDist, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
