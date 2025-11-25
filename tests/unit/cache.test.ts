import { CacheService } from "../../src/services/cache.service";
import * as fs from "fs";
import * as path from "path";

describe("Cache Service - Czech Data", () => {
  let cacheService: CacheService;
  const testDbPath = path.join(process.cwd(), "test-cache.db");

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    cacheService = new CacheService();
    await cacheService.init("test-cache.db");
  });

  afterEach(async () => {
    await cacheService.close();

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it("init() creates the database and table", async () => {
    const result = await cacheService.getCachedMenu("https://restaurace.cz", "2025-11-23");
    expect(result).toBeNull();
  });

  it("saveMenuToCache() inserts Czech menu data", async () => {
    const url = "https://restaurace.cz";
    const date = "2025-11-23";
    const data = {
      restaurant_name: "Test Restaurace",
      date: "2025-11-23",
      day_of_week: "Neděle",
      menu_items: [
        { name: "Polévka", price: 45 },
        { name: "Svíčková", price: 145 }
      ],
      daily_menu: true,
      recommendedMeal: null
    };

    await cacheService.saveMenuToCache(url, date, data);

    const retrieved = await cacheService.getCachedMenu(url, date);
    expect(retrieved).toEqual(data);
    expect(retrieved.menu_items[0].name).toBe("Polévka");
    expect(retrieved.menu_items[1].name).toBe("Svíčková");
  });

  it("getCachedMenu() returns inserted Czech data", async () => {
    const url = "https://ceska-restaurace.cz";
    const date = "2025-11-23";
    const data = {
      restaurant_name: "Česká Restaurace",
      date: "2025-11-23",
      day_of_week: "Neděle",
      menu_items: [
        { name: "Hovězí vývar s nudlemi", price: 45 },
        { name: "Vepřové s knedlíky", price: 125 },
        { name: "Guláš", price: 135 }
      ],
      daily_menu: true,
      recommendedMeal: null
    };

    await cacheService.saveMenuToCache(url, date, data);

    const result = await cacheService.getCachedMenu(url, date);

    expect(result).toEqual(data);
    expect(result.menu_items).toHaveLength(3);
    expect(result.menu_items[0].name).toBe("Hovězí vývar s nudlemi");
    expect(result.menu_items[1].name).toBe("Vepřové s knedlíky");
    expect(result.menu_items[2].name).toBe("Guláš");
  });

  it("getCachedMenu() returns null for missing data", async () => {
    const result = await cacheService.getCachedMenu(
      "https://neexistujici-restaurace.cz",
      "2025-11-23"
    );

    expect(result).toBeNull();
  });

  it("invalidateOldRecords() deletes entries with date < today", async () => {
    const url = "https://restaurace.cz";
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Create a date string for yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const oldData = {
      restaurant_name: "Old Menu",
      date: yesterdayStr,
      day_of_week: "Neděle",
      menu_items: [{ name: "Old Polévka", price: 45 }],
      daily_menu: true,
      recommendedMeal: null
    };

    const todayData = {
      restaurant_name: "Today Menu",
      date: todayStr,
      day_of_week: "Pondělí",
      menu_items: [{ name: "Today Polévka", price: 50 }],
      daily_menu: true,
      recommendedMeal: null
    };

    // Save both old and today's menus
    await cacheService.saveMenuToCache(url, yesterdayStr, oldData);
    await cacheService.saveMenuToCache(url, todayStr, todayData);

    // Verify both exist before cleanup
    expect(await cacheService.getCachedMenu(url, yesterdayStr)).toEqual(oldData);
    expect(await cacheService.getCachedMenu(url, todayStr)).toEqual(todayData);

    // Run cleanup
    await cacheService.invalidateOldRecords();

    // Old entry should be deleted, today's should remain
    expect(await cacheService.getCachedMenu(url, yesterdayStr)).toBeNull();
    expect(await cacheService.getCachedMenu(url, todayStr)).toEqual(todayData);
  });

  it("getCachedMenu() does NOT return yesterday's menu when requesting today", async () => {
    const url = "https://restaurace.cz";
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const yesterdayData = {
      restaurant_name: "Yesterday Menu",
      date: yesterdayStr,
      day_of_week: "Neděle",
      menu_items: [{ name: "Yesterday Polévka", price: 45 }],
      daily_menu: true,
      recommendedMeal: null
    };

    // Save yesterday's menu
    await cacheService.saveMenuToCache(url, yesterdayStr, yesterdayData);

    // Request today's menu - should return null (not yesterday's)
    const result = await cacheService.getCachedMenu(url, todayStr);
    expect(result).toBeNull();

    // But yesterday's menu should still be retrievable with yesterday's date
    const yesterdayResult = await cacheService.getCachedMenu(url, yesterdayStr);
    expect(yesterdayResult).toEqual(yesterdayData);
  });

  it("menus for different dates are stored separately", async () => {
    const url = "https://restaurace.cz";
    const date1 = "2025-11-23";
    const date2 = "2025-11-24";
    
    const data1 = {
      restaurant_name: "Restaurant",
      date: date1,
      day_of_week: "Neděle",
      menu_items: [{ name: "Menu 1", price: 45 }],
      daily_menu: true,
      recommendedMeal: null
    };

    const data2 = {
      restaurant_name: "Restaurant",
      date: date2,
      day_of_week: "Pondělí",
      menu_items: [{ name: "Menu 2", price: 50 }],
      daily_menu: true,
      recommendedMeal: null
    };

    await cacheService.saveMenuToCache(url, date1, data1);
    await cacheService.saveMenuToCache(url, date2, data2);

    // Each date should return its own menu
    const result1 = await cacheService.getCachedMenu(url, date1);
    const result2 = await cacheService.getCachedMenu(url, date2);

    expect(result1).toEqual(data1);
    expect(result2).toEqual(data2);
    expect(result1.menu_items[0].name).toBe("Menu 1");
    expect(result2.menu_items[0].name).toBe("Menu 2");
  });

  it("caches multiple Czech restaurants separately", async () => {
    const url1 = "https://restaurace-u-fleku.cz";
    const url2 = "https://hospoda-na-rohu.cz";
    const date = "2025-11-23";
    
    const data1 = {
      restaurant_name: "U Fleků",
      date: "2025-11-23",
      day_of_week: "Neděle",
      menu_items: [{ name: "Polévka", price: 45 }],
      daily_menu: true,
      recommendedMeal: null
    };
    const data2 = {
      restaurant_name: "Hospoda Na Rohu",
      date: "2025-11-23",
      day_of_week: "Neděle",
      menu_items: [{ name: "Guláš", price: 135 }],
      daily_menu: true,
      recommendedMeal: null
    };

    await cacheService.saveMenuToCache(url1, date, data1);
    await cacheService.saveMenuToCache(url2, date, data2);

    const result1 = await cacheService.getCachedMenu(url1, date);
    const result2 = await cacheService.getCachedMenu(url2, date);

    expect(result1.menu_items[0].name).toBe("Polévka");
    expect(result2.menu_items[0].name).toBe("Guláš");
  });

  it("auto-heals corrupted JSON in cache", async () => {
    const url = "https://restaurace.cz";
    const date = "2025-11-23";
    
    // Manually insert corrupted JSON
    const db = (cacheService as any).getDb();
    await db.run(
      `INSERT INTO menu_cache (url, date, data) VALUES (?, ?, ?)`,
      [url, date, "invalid json {broken"]
    );

    // getCachedMenu should return null and delete the corrupted entry
    const result = await cacheService.getCachedMenu(url, date);
    expect(result).toBeNull();

    // Verify the corrupted entry was deleted
    const check = await db.get(
      `SELECT * FROM menu_cache WHERE url = ? AND date = ?`,
      [url, date]
    );
    expect(check).toBeUndefined();
  });
});
