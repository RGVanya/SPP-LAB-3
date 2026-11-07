const { Pool } = require('pg');

function createPool(connectionString) {
  return new Pool({ connectionString, max: 10 });
}

async function waitForDatabase(pool) {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

module.exports = { createPool, waitForDatabase };
