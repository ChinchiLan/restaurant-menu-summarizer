import "dotenv/config";
import express from "express";
import summarizeRouter from "./routes/summarize.route";
import { cacheService } from "./services/cache";

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
    console.log("Cache database initialized");

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown handlers
    process.on("SIGTERM", async () => {
      console.log("SIGTERM received, closing cache database...");
      await cacheService.close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("SIGINT received, closing cache database...");
      await cacheService.close();
      process.exit(0);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;

