import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

/**
 * Cache service for storing daily restaurant menu results in SQLite.
 * Cache key = URL + date
 */
export class CacheService {
  private db: Database | null = null;

  /**
   * Initialize the SQLite database and create the menu_cache table.
   * Must be called before using any other methods.
   */
  async init(): Promise<void> {
    try {
      this.db = await open({
        filename: "./cache.db",
        driver: sqlite3.Database
      });

      // Create table with unique constraint on (url, date)
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS menu_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          date TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(url, date)
        );
      `);

      // Create index for faster lookups
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_url_date ON menu_cache(url, date);
      `);

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize cache database: ${error.message}`);
      }
      throw new Error("Failed to initialize cache database: Unknown error");
    }
  }

  /**
   * Retrieve cached menu data for a specific URL and date.
   * 
   * @param url - The restaurant URL
   * @param date - The date in format YYYY-MM-DD
   * @returns Parsed menu data or null if not found
   */
  async getCachedMenu(url: string, date: string): Promise<any | null> {
    this.ensureInitialized();

    try {
      const row = await this.db!.get(
        "SELECT data FROM menu_cache WHERE url = ? AND date = ?",
        [url, date]
      );

      if (!row) {
        return null;
      }

      // Parse the JSON string back to object
      return JSON.parse(row.data);

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get cached menu: ${error.message}`);
      }
      throw new Error("Failed to get cached menu: Unknown error");
    }
  }

  /**
   * Save menu data to cache for a specific URL and date.
   * Uses INSERT OR REPLACE to update existing entries.
   * 
   * @param url - The restaurant URL
   * @param date - The date in format YYYY-MM-DD
   * @param data - The menu data to cache (will be JSON stringified)
   */
  async saveMenuToCache(url: string, date: string, data: any): Promise<void> {
    this.ensureInitialized();

    try {
      // Serialize data to JSON string
      const jsonData = JSON.stringify(data);

      await this.db!.run(
        `INSERT OR REPLACE INTO menu_cache (url, date, data, created_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [url, date, jsonData]
      );

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to save menu to cache: ${error.message}`);
      }
      throw new Error("Failed to save menu to cache: Unknown error");
    }
  }

  /**
   * Remove cache entries older than 1 day.
   * This helps keep the database size manageable.
   */
  async invalidateOldRecords(): Promise<void> {
    this.ensureInitialized();

    // TODO: Consider invalidating based on the menu date field instead of created_at
    // TODO: Add configurable retention period (e.g., keep 7 days of history)
    // TODO: Add manual invalidation method for specific URLs or dates
    // TODO: Add cache statistics (size, hit rate, etc.)

    try {
      const result = await this.db!.run(
        "DELETE FROM menu_cache WHERE created_at < datetime('now', '-1 day')"
      );

      console.log(`Invalidated ${result.changes} old cache entries`);

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to invalidate old records: ${error.message}`);
      }
      throw new Error("Failed to invalidate old records: Unknown error");
    }
  }

  /**
   * Close the database connection.
   * Should be called when shutting down the application.
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to close database: ${error.message}`);
        }
        throw new Error("Failed to close database: Unknown error");
      }
    }
  }

  /**
   * Check if the database has been initialized.
   * @throws Error if not initialized
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error("Cache not initialized. Call init() first.");
    }
  }
}

// Export a singleton instance for convenience
export const cacheService = new CacheService();
