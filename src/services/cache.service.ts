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

  /**
   * Get today's date in YYYY-MM-DD format using local timezone (Europe/Prague)
   * This ensures date-based TTL resets at midnight local time
   */
  private getTodayDate(): string {
    // Use local timezone (Europe/Prague)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
          created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
          UNIQUE(url, date)
        );
      `);

      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_url_date ON menu_cache(url, date);
      `);

      // Run cleanup on startup to remove expired entries
      await this.invalidateOldRecords();

      logger.system(LOG_MESSAGES.CACHE_INITIALIZED, { db: filename });
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.InitFailedError({ reason: error.message });
      }
      throw new CacheErrors.InitFailedError();
    }
  }

  /**
   * Get cached menu for a specific URL and date
   * TTL is date-based: entries are valid ONLY for the specific calendar date
   * A menu cached for 2025-11-24 will NEVER be reused on 2025-11-25
   * 
   * Auto-healing: If JSON parsing fails (corrupted data), deletes the row
   * and returns null to force a fresh extraction
   */
  async getCachedMenu(url: string, date: string): Promise<any | null> {
    try {
      const db = this.getDb();
      // Date-based TTL: only return entry if record.date matches requested date
      // No timestamp check needed - date string comparison is sufficient
      const row = await db.get(
        `SELECT data, id FROM menu_cache 
         WHERE url = ? AND date = ?`,
        [url, date]
      );

      if (!row) {
        logger.info(LOG_SOURCES.CACHE, LOG_MESSAGES.CACHE_MISS, { url, date });
        return null;
      }

      // Safe JSON parsing with auto-healing
      try {
        const parsed = JSON.parse(row.data);
        logger.info(LOG_SOURCES.CACHE, LOG_MESSAGES.CACHE_HIT, { url, date });
        return parsed;
      } catch (parseError) {
        // Corrupted JSON - delete the row and return null
        logger.warn(LOG_SOURCES.CACHE, "Corrupted cache entry detected, deleting", { url, date });
        await db.run(`DELETE FROM menu_cache WHERE id = ?`, [row.id]);
        return null;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new CacheErrors.ReadFailedError({ reason: error.message, url, date });
      }
      throw new CacheErrors.ReadFailedError({ url, date });
    }
  }

  /**
   * Save menu to cache with local timezone timestamp
   */
  async saveMenuToCache(url: string, date: string, data: any): Promise<void> {
    try {
      const db = this.getDb();
      const jsonData = JSON.stringify(data);
      // Use localtime for timestamp (Europe/Prague timezone)
      await db.run(
        `INSERT OR REPLACE INTO menu_cache (url, date, data, created_at) 
         VALUES (?, ?, ?, strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))`,
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

  /**
   * Delete all cache entries where date < today
   * This ensures menus from previous days are automatically cleaned up
   * 
   * Date-based cleanup (not timestamp-based) - follows assignment requirements:
   * Cache entries are valid ONLY for the specific calendar date they were created for.
   * A menu cached for 2025-11-24 will NEVER be reused on 2025-11-25.
   * This cleanup runs on startup and at midnight to prevent DB growth.
   */
  async invalidateOldRecords(): Promise<void> {
    try {
      const db = this.getDb();
      const todayDate = this.getTodayDate();
      
      // Delete all rows where date < today (string comparison works for YYYY-MM-DD format)
      const result = await db.run(
        `DELETE FROM menu_cache WHERE date < ?`,
        [todayDate]
      );

      logger.info(LOG_SOURCES.CACHE, LOG_MESSAGES.INVALIDATED_OLD_RECORDS, { 
        count: result.changes,
        todayDate 
      });
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
