const fs = require("node:fs/promises");
const path = require("node:path");

const { query } = require("./pool");

const schemaFilePath = path.resolve(__dirname, "..", "..", "db", "init.sql");

let schemaSqlPromise;

async function loadSchemaSql() {
  if (!schemaSqlPromise) {
    schemaSqlPromise = fs.readFile(schemaFilePath, "utf-8");
  }

  return schemaSqlPromise;
}

async function ensureDatabaseSchema() {
  const schemaSql = await loadSchemaSql();
  await query(schemaSql);
}

async function checkDatabaseConnection() {
  await query("SELECT 1 AS ok");
}

module.exports = {
  ensureDatabaseSchema,
  checkDatabaseConnection,
};
