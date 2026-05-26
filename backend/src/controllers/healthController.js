const mlClient = require("../integrations/ml/mlClient");
const { checkDatabaseConnection } = require("../database/schema");

async function getHealth(req, res, next) {
  let mlStatus = { status: "unavailable" };
  let databaseStatus = { status: "unavailable" };

  try {
    await checkDatabaseConnection();
    databaseStatus = {
      status: "ok",
    };
  } catch (error) {
    databaseStatus = {
      status: "unavailable",
      details: error.message,
    };
  }

  try {
    const mlHealth = await mlClient.getHealth();
    mlStatus = {
      status: "ok",
      details: mlHealth,
    };
  } catch (error) {
    mlStatus = {
      status: "unavailable",
      details: error.message,
    };
  }

  res.json({
    status: "ok",
    service: "node-backend",
    timestamp: new Date().toISOString(),
    database: databaseStatus,
    mlService: mlStatus,
  });
}

module.exports = {
  getHealth,
};
