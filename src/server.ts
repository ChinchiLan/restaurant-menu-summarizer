import "dotenv/config";
import express from "express";
import summarizeRouter from "./routes/summarize.route";
import { cacheService } from "./services/cache.service";
import { logger } from "./utils/logger";
import { LOG_SOURCES, LOG_MESSAGES, SERVER_CONFIG } from "./constants/log";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

// Request body size limit: prevents DoS via large payloads
app.use(express.json({ limit: SERVER_CONFIG.JSON_BODY_LIMIT }));

// Request timeout: prevents hanging requests
app.use((req, res, next) => {
  const timeout = SERVER_CONFIG.REQUEST_TIMEOUT_MS;
  req.setTimeout(timeout, () => {
    res.status(408).json({
      error: {
        code: "REQUEST_TIMEOUT",
        message: "Request timeout",
        details: {}
      }
    });
  });
  next();
});

app.use("/api", summarizeRouter);

// Global error handler (must be last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || SERVER_CONFIG.DEFAULT_PORT;

/**
 * Initialize services and start the server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize cache database (cleanup runs automatically on init)
    await cacheService.init();
    logger.system(LOG_MESSAGES.CACHE_DATABASE_INITIALIZED);

    // Set up periodic cache cleanup at midnight (when date changes)
    // This ensures expired entries are removed when the calendar date changes
    const scheduleMidnightCleanup = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Midnight
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          await cacheService.invalidateOldRecords();
          // Schedule next cleanup for next midnight
          scheduleMidnightCleanup();
        } catch (error) {
          logger.error(LOG_SOURCES.CACHE, "Failed to cleanup old cache records at midnight", { 
            error: error instanceof Error ? error.message : "unknown" 
          });
          // Still schedule next cleanup even if this one failed
          scheduleMidnightCleanup();
        }
      }, msUntilMidnight);
    };

    // Start midnight cleanup scheduler
    scheduleMidnightCleanup();

    // Clear interval on shutdown
    const cleanup = async () => {
      await cacheService.close();
    };

    // Start listening
    app.listen(PORT, () => {
      logger.system(LOG_MESSAGES.SERVER_LISTENING, { port: PORT });
    });

    // Graceful shutdown handlers
    process.on("SIGTERM", async () => {
      logger.system(LOG_MESSAGES.GRACEFUL_SHUTDOWN, { signal: "SIGTERM" });
      await cleanup();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.system(LOG_MESSAGES.GRACEFUL_SHUTDOWN, { signal: "SIGINT" });
      await cleanup();
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

