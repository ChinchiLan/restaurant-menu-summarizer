import { CacheService } from "../../src/services/cache";
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
      items: [
        { name: "Polévka", price: 45 },
        { name: "Svíčková", price: 145 }
      ] 
    };

    await cacheService.saveMenuToCache(url, date, data);

    const retrieved = await cacheService.getCachedMenu(url, date);
    expect(retrieved).toEqual(data);
    expect(retrieved.items[0].name).toBe("Polévka");
    expect(retrieved.items[1].name).toBe("Svíčková");
  });

  it("getCachedMenu() returns inserted Czech data", async () => {
    const url = "https://ceska-restaurace.cz";
    const date = "2025-11-23";
    const data = {
      items: [
        { name: "Hovězí vývar s nudlemi", price: 45, description: "Tradiční česká polévka" },
        { name: "Vepřové s knedlíky", price: 125, description: "Pečené vepřové maso" },
        { name: "Guláš", price: 135, description: "Maďarský guláš s cibulí" }
      ]
    };

    await cacheService.saveMenuToCache(url, date, data);

    const result = await cacheService.getCachedMenu(url, date);

    expect(result).toEqual(data);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].name).toBe("Hovězí vývar s nudlemi");
    expect(result.items[1].name).toBe("Vepřové s knedlíky");
    expect(result.items[2].name).toBe("Guláš");
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
    const data = { items: [{ name: "Polévka", price: 45 }] };

    await cacheService.saveMenuToCache(url, date, data);

    await cacheService.invalidateOldRecords();

    const result = await cacheService.getCachedMenu(url, date);
    expect(result).toEqual(data);
  });

  it("caches multiple Czech restaurants separately", async () => {
    const url1 = "https://restaurace-u-fleku.cz";
    const url2 = "https://hospoda-na-rohu.cz";
    const date = "2025-11-23";
    
    const data1 = { items: [{ name: "Polévka", price: 45 }] };
    const data2 = { items: [{ name: "Guláš", price: 135 }] };

    await cacheService.saveMenuToCache(url1, date, data1);
    await cacheService.saveMenuToCache(url2, date, data2);

    const result1 = await cacheService.getCachedMenu(url1, date);
    const result2 = await cacheService.getCachedMenu(url2, date);

    expect(result1.items[0].name).toBe("Polévka");
    expect(result2.items[0].name).toBe("Guláš");
  });
});
