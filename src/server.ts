import "dotenv/config";
import express from "express";
import summarizeRouter from "./routes/summarize.route";
import { cacheService } from "./services/cache.service";
import { logger } from "./utils/logger";
import { LOG_SOURCES, LOG_MESSAGES } from "./constants/log";

const app = express();
app.use(express.json());
app.use("/api", summarizeRouter);

const PORT = process.env.PORT || 3000;

/**
 * Initialize services and start the server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize cache database
    await cacheService.init();
    logger.system(LOG_MESSAGES.CACHE_DATABASE_INITIALIZED);

    // Start listening
    app.listen(PORT, () => {
      logger.system(LOG_MESSAGES.SERVER_LISTENING, { port: PORT });
    });

    // Graceful shutdown handlers
    process.on("SIGTERM", async () => {
      logger.system(LOG_MESSAGES.GRACEFUL_SHUTDOWN, { signal: "SIGTERM" });
      await cacheService.close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.system(LOG_MESSAGES.GRACEFUL_SHUTDOWN, { signal: "SIGINT" });
      await cacheService.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error(LOG_SOURCES.SERVER, LOG_MESSAGES.FAILED_TO_START_SERVER, { reason: error instanceof Error ? error.message : "unknown" });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;

