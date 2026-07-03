import "./src/config/env"; // Validates all required env vars at startup — exits if any are missing
import app from "./app";
import { DBconnection } from "./src/config/DBConnect";
import { bootMasterAdmin } from "./src/Seed_Creation/bootMasterAdmin";
import { bootCountry } from "./src/Seed_Creation/bootCountry";
import { bootState } from "./src/Seed_Creation/bootState"
import { runMigrations } from "./migrations/runMigrations";
import { initDB } from "./src/config/initDB";
import { logger } from "./src/utils/logger";
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initDB();

    // Confirm database is accepting connections before proceeding.
    let dbReady = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const { error } = await DBconnection.from("users").select("id").limit(1);
        if (!error || (error && error.message && error.message.includes("No rows"))) {
          dbReady = true;
          break;
        }
        logger.warn(`Waiting for database (attempt ${attempt}/5)`, { error: error?.message });
      } catch (err: any) {
        logger.warn(`Waiting for database (attempt ${attempt}/5)`, { error: err.message });
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!dbReady) {
      logger.error("MySQL database did not become ready in time");
      process.exit(1);
    }

    logger.info("Database connected successfully");
    await runMigrations();
    await bootMasterAdmin();
    const countryId = await bootCountry();
    if (countryId) {
      await bootState(countryId);
    }

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
    });

    async function shutdown(signal: string) {
      logger.info(`Received ${signal}, shutting down gracefully`);
      server.close(async () => {
        // When Redis / BullMQ are added, close them here before process.exit:
        //   await redisClient.quit();
        //   await emailQueue.close();
        logger.info("HTTP server closed");
        process.exit(0);
      });
      // Force exit if graceful shutdown takes more than 10 seconds
      setTimeout(() => {
        logger.error("Graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, 10_000);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err: any) {
    logger.error("Unexpected startup error", { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled Promise Rejection", { reason });
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception", { message: error.message, stack: error.stack });
  process.exit(1);
});

startServer();
