import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { logger } from "../utils/logger";
import { CacheErrors } from "../errors";
import { LOG_SOURCES, LOG_MESSAGES } from "../constants/log";

export class CacheService {
  private db?: Database;

  private getDb(): Database {
    if (!this.db) {
      throw new CacheErrors.NotInitializedError();
    }
    return this.db;
  }

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

      logger.system(LOG_MESSAGES.CACHE_INITIALIZED, { db: filename });
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.InitFailedError({ reason: error.message });
      }
      throw new CacheErrors.InitFailedError();
    }
  }

  async getCachedMenu(url: string, date: string): Promise<any | null> {
    try {
      const db = this.getDb();
      const row = await db.get(
        "SELECT data FROM menu_cache WHERE url = ? AND date = ?",
        [url, date]
      );

      if (!row) {
        logger.info(LOG_SOURCES.CACHE, LOG_MESSAGES.CACHE_MISS, { url, date });
        return null;
      }

      logger.info(LOG_SOURCES.CACHE, LOG_MESSAGES.CACHE_HIT, { url, date });
      return JSON.parse(row.data);
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.ReadFailedError({ reason: error.message, url, date });
      }
      throw new CacheErrors.ReadFailedError({ url, date });
    }
  }

  async saveMenuToCache(url: string, date: string, data: any): Promise<void> {
    try {
      const db = this.getDb();
      const jsonData = JSON.stringify(data);
      await db.run(
        `INSERT OR REPLACE INTO menu_cache (url, date, data, created_at) VALUES (?, ?, ?, datetime('now'))`,
        [url, date, jsonData]
      );

      logger.info(LOG_SOURCES.CACHE, LOG_MESSAGES.SAVED_TO_CACHE, { url, date });
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.WriteFailedError({ reason: error.message, url, date });
      }
      throw new CacheErrors.WriteFailedError({ url, date });
    }
  }

  async invalidateOldRecords(): Promise<void> {
    try {
      const db = this.getDb();
      const result = await db.run(
        "DELETE FROM menu_cache WHERE created_at < datetime('now', '-1 day')"
      );

      logger.info(LOG_SOURCES.CACHE, LOG_MESSAGES.INVALIDATED_OLD_RECORDS, { count: result.changes });
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
        this.db = undefined;
        logger.system(LOG_MESSAGES.CACHE_DATABASE_CLOSED);
      } catch (error) {
        if (error instanceof Error) {
          throw new CacheErrors.CloseFailedError({ reason: error.message });
        }
        throw new CacheErrors.CloseFailedError();
      }
    }
  }
}

export const cacheService = new CacheService();
