const app = require("./app");
const env = require("./config/env");
const { closePool } = require("./database/pool");
const { ensureDatabaseSchema } = require("./database/schema");
const adminMlService = require("./services/adminMlService");
const authService = require("./services/authService");

async function bootstrap() {
  await ensureDatabaseSchema();
  await authService.ensureDefaultAdmin();
  await adminMlService.initializeAdminMlState();

  const server = app.listen(env.port, () => {
    console.log(`Node backend is running on http://localhost:${env.port}`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received, shutting down backend...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
