const { Pool } = require("pg");

const env = require("../config/env");

let pool;

function createPool() {
  if (env.databaseUrl) {
    return new Pool({
      connectionString: env.databaseUrl,
      ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
    });
  }

  return new Pool({
    host: env.dbHost,
    port: env.dbPort,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
  });
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}

module.exports = {
  getPool,
  query,
  closePool,
};
