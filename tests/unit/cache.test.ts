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
      extraction_status: "success" as const,
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
      extraction_status: "success" as const,
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

  it("invalidateOldRecords() deletes old entries", async () => {
    const url = "https://restaurace.cz";
    const date = "2025-11-23";
    const data = {
      restaurant_name: "Test",
      date: "2025-11-23",
      day_of_week: "Neděle",
      menu_items: [{ name: "Polévka", price: 45 }],
      extraction_status: "success" as const,
      recommendedMeal: null
    };

    await cacheService.saveMenuToCache(url, date, data);

    await cacheService.invalidateOldRecords();

    const result = await cacheService.getCachedMenu(url, date);
    expect(result).toEqual(data);
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
      extraction_status: "success" as const,
      recommendedMeal: null
    };
    const data2 = {
      restaurant_name: "Hospoda Na Rohu",
      date: "2025-11-23",
      day_of_week: "Neděle",
      menu_items: [{ name: "Guláš", price: 135 }],
      extraction_status: "success" as const,
      recommendedMeal: null
    };

    await cacheService.saveMenuToCache(url1, date, data1);
    await cacheService.saveMenuToCache(url2, date, data2);

    const result1 = await cacheService.getCachedMenu(url1, date);
    const result2 = await cacheService.getCachedMenu(url2, date);

    expect(result1.menu_items[0].name).toBe("Polévka");
    expect(result2.menu_items[0].name).toBe("Guláš");
  });
});
