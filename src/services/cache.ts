import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { logger } from "../utils/logger";
import { CacheErrors } from "../errors";

export class CacheService {
  private db: Database | null = null;

  async init(filename: string = "./cache.db"): Promise<void> {
    try {
      this.db = await open({
        filename: filename,
        driver: sqlite3.Database
      });

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

      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_url_date ON menu_cache(url, date);
      `);

      logger.system("Cache initialized", { db: filename });
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.InitFailedError({ reason: error.message });
      }
      throw new CacheErrors.InitFailedError();
    }
  }

  async getCachedMenu(url: string, date: string): Promise<any | null> {
    this.ensureInitialized();

    try {
      const row = await this.db!.get(
        "SELECT data FROM menu_cache WHERE url = ? AND date = ?",
        [url, date]
      );

      if (!row) {
        logger.info("CACHE", "Cache miss", { url, date });
        return null;
      }

      logger.info("CACHE", "Cache hit", { url, date });
      return JSON.parse(row.data);
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.ReadFailedError({ reason: error.message, url, date });
      }
      throw new CacheErrors.ReadFailedError({ url, date });
    }
  }

  async saveMenuToCache(url: string, date: string, data: any): Promise<void> {
    this.ensureInitialized();

    try {
      const jsonData = JSON.stringify(data);
      await this.db!.run(
        `INSERT OR REPLACE INTO menu_cache (url, date, data, created_at) VALUES (?, ?, ?, datetime('now'))`,
        [url, date, jsonData]
      );

      logger.info("CACHE", "Saved to cache", { url, date });
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.WriteFailedError({ reason: error.message, url, date });
      }
      throw new CacheErrors.WriteFailedError({ url, date });
    }
  }

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

      logger.info("CACHE", "Invalidated old records", { count: result.changes });
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.InvalidateFailedError({ reason: error.message });
      }
      throw new CacheErrors.InvalidateFailedError();
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
      } catch (error) {
        if (error instanceof Error) {
          throw new CacheErrors.CloseFailedError({ reason: error.message });
        }
        throw new CacheErrors.CloseFailedError();
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new CacheErrors.NotInitializedError();
    }
  }
}

export const cacheService = new CacheService();
