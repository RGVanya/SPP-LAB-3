const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { createLogger } = require('./logger');
const { createPool, waitForDatabase } = require('./db/pool');
const { createContainer } = require('./container');
const { createApp } = require('./app');

const logger = createLogger({ level: config.logLevel });

async function main() {
  if (!config.auth.jwtSecret) {
    config.auth.jwtSecret = crypto.randomBytes(32).toString('hex');
    logger.warn('JWT_SECRET не задан: сгенерирован случайный, ключи станут недействительны после перезапуска');
  }

  const pool = createPool(config.databaseUrl);
  await waitForDatabase(pool);

  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);

  const container = createContainer({ pool, config });
  await container.userService.seed(config.seed, logger);
  const app = createApp({ ...container, config, logger });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, `Сервер слушает порт ${config.port}`);
  });

  async function shutdown() {
    server.close();
    await pool.end();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Сервер не запустился');
  process.exit(1);
});
