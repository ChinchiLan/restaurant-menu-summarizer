import { menuService } from "../../src/services/menu.service";
import { scraperService } from "../../src/services/scraper.service";
import { llmService } from "../../src/services/llm.service";
import { cacheService } from "../../src/services/cache.service";
import * as fs from "fs";
import * as path from "path";

jest.mock("../../src/services/scraper.service");
jest.mock("../../src/services/llm.service");

const mockedScrape = scraperService.scrape as jest.MockedFunction<typeof scraperService.scrape>;
const mockedExtractMenu = llmService.extractMenu as jest.MockedFunction<typeof llmService.extractMenu>;
const mockedExtractRestaurantName = llmService.extractRestaurantName as jest.MockedFunction<typeof llmService.extractRestaurantName>;

describe("MenuService", () => {
  const testDbPath = path.join(process.cwd(), "test-menu-service.db");

  beforeAll(async () => {
    await cacheService.init("test-menu-service.db");
  });

  afterAll(async () => {
    await cacheService.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockedScrape.mockResolvedValue({
      html: "<html><body><h1>Denní menu</h1><h2>Pondělí</h2><p>Polévka 45 Kč</p><p>Řízek 120 Kč</p></body></html>",
      text: "Denní menu Pondělí Polévka 45 Kč Řízek 120 Kč"
    });

    mockedExtractMenu.mockResolvedValue({
      items: [
        { name: "Polévka", price: 45, allergens: null, category: "polévka" },
        { name: "Řízek", price: 120, allergens: ["1", "3"], category: "hlavní jídlo" }
      ]
    });

    mockedExtractRestaurantName.mockResolvedValue("Test Restaurant");
  });

  describe("hasDailyMenuIndicators()", () => {
    it("returns true for page with 'denní menu' keyword and weekday", () => {
      const service = menuService as any;
      const text = "Denní menu Pondělí Polévka 45 Kč Řízek 120 Kč";
      expect(service.hasDailyMenuIndicators(text)).toBe(true);
    });

    it("returns true for page with 'polední menu' keyword and date pattern", () => {
      const service = menuService as any;
      const text = "Polední menu 24.11. Polévka 45 Kč Svíčková 145 Kč";
      expect(service.hasDailyMenuIndicators(text)).toBe(true);
    });

    it("returns true for page with 'týdenní menu' and multiple prices", () => {
      const service = menuService as any;
      const text = "Týdenní menu Polévka 65 Kč Řízek 125 Kč Guláš 135 Kč";
      expect(service.hasDailyMenuIndicators(text)).toBe(true);
    });

    it("returns true for page with soup + main dish keywords", () => {
      const service = menuService as any;
      const text = "Polední menu dnes: Polévka a řízek s brambory";
      expect(service.hasDailyMenuIndicators(text)).toBe(true);
    });

    it("returns false when no daily menu keyword present", () => {
      const service = menuService as any;
      const text = "Jídelní lístek Stálá nabídka Polévka Hlavní jídlo";
      expect(service.hasDailyMenuIndicators(text)).toBe(false);
    });

    it("returns false for navigation-only page (Tlustá Kachna scenario)", () => {
      const service = menuService as any;
      const text = "Úvod Polední menu Kontakty O nás Rezervace Ubytování Galerie";
      expect(service.hasDailyMenuIndicators(text)).toBe(false);
    });

    it("returns false when keyword present but no strong signal", () => {
      const service = menuService as any;
      const text = "Denní menu je k dispozici Úvod Kontakty O nás Rezervace";
      expect(service.hasDailyMenuIndicators(text)).toBe(false);
    });
  });

  describe("isMostlyNavigation()", () => {
    it("returns true when 3+ navigation keywords present", () => {
      const service = menuService as any;
      const context = "úvod o nás kontakty rezervace polední menu";
      expect(service.isMostlyNavigation(context)).toBe(true);
    });

    it("returns false when less than 3 navigation keywords", () => {
      const service = menuService as any;
      const context = "úvod polední menu pondělí polévka 45 kč";
      expect(service.isMostlyNavigation(context)).toBe(false);
    });

    it("returns false for actual menu content", () => {
      const service = menuService as any;
      const context = "denní menu polévka řízek svíčková 145 kč";
      expect(service.isMostlyNavigation(context)).toBe(false);
    });
  });

  describe("hasStrongDailySignal()", () => {
    it("returns true when weekday present", () => {
      const service = menuService as any;
      const context = "polední menu pondělí polévka";
      expect(service.hasStrongDailySignal(context)).toBe(true);
    });

    it("returns true when date pattern present", () => {
      const service = menuService as any;
      const context = "menu 24.11. polévka svíčková";
      expect(service.hasStrongDailySignal(context)).toBe(true);
    });

    it("returns true when 2+ valid prices (60-200 Kč)", () => {
      const service = menuService as any;
      const context = "polévka 65 kč řízek 125 kč";
      expect(service.hasStrongDailySignal(context)).toBe(true);
    });

    it("returns true when soup + main dish keywords present", () => {
      const service = menuService as any;
      const context = "polévka a svíčková s knedlíky";
      expect(service.hasStrongDailySignal(context)).toBe(true);
    });

    it("returns false when no strong signals", () => {
      const service = menuService as any;
      const context = "úvod o nás kontakty";
      expect(service.hasStrongDailySignal(context)).toBe(false);
    });

    it("returns false when prices are outside daily menu range", () => {
      const service = menuService as any;
      const context = "menu 30 kč 450 kč";  // Too low and too high
      expect(service.hasStrongDailySignal(context)).toBe(false);
    });
  });

  describe("applyPreferencesFilter()", () => {
    it("filters items by price", () => {
      const service = menuService as any;
      const items = [
        { name: "Cheap", price: 50, allergens: null, category: "polévka" },
        { name: "Expensive", price: 200, allergens: null, category: "hlavní jídlo" }
      ];
      const preferences = { price: 100 };
      
      const result = service.applyPreferencesFilter(items, preferences);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Cheap");
    });

    it("filters items by allergens", () => {
      const service = menuService as any;
      const items = [
        { name: "Safe", price: 100, allergens: ["1"], category: "polévka" },
        { name: "Unsafe", price: 100, allergens: ["1", "7"], category: "hlavní jídlo" }
      ];
      const preferences = { allergens: [7] };
      
      const result = service.applyPreferencesFilter(items, preferences);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Safe");
    });

    it("keeps items with null allergens when filtering by allergens", () => {
      const service = menuService as any;
      const items = [
        { name: "Unknown", price: 100, allergens: null, category: "polévka" },
        { name: "HasAllergen", price: 100, allergens: ["7"], category: "hlavní jídlo" }
      ];
      const preferences = { allergens: [7] };
      
      const result = service.applyPreferencesFilter(items, preferences);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Unknown");
    });

    it("filters by both price and allergens", () => {
      const service = menuService as any;
      const items = [
        { name: "Good", price: 80, allergens: null, category: "polévka" },
        { name: "TooExpensive", price: 200, allergens: null, category: "hlavní jídlo" },
        { name: "HasAllergen", price: 80, allergens: ["7"], category: "hlavní jídlo" }
      ];
      const preferences = { price: 100, allergens: [7] };
      
      const result = service.applyPreferencesFilter(items, preferences);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Good");
    });

    it("excludes items with missing price when price filter is set", () => {
      const service = menuService as any;
      const items = [
        { name: "WithPrice", price: 80, allergens: null, category: "polévka" },
        { name: "NoPrice", allergens: null, category: "hlavní jídlo" }  // Missing price
      ];
      const preferences = { price: 100 };
      
      const result = service.applyPreferencesFilter(items, preferences);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("WithPrice");
    });

    it("returns all items when no preferences provided", () => {
      const service = menuService as any;
      const items = [
        { name: "Item1", price: 50, allergens: null, category: "polévka" },
        { name: "Item2", price: 200, allergens: ["7"], category: "hlavní jídlo" }
      ];
      const preferences = {};
      
      const result = service.applyPreferencesFilter(items, preferences);
      
      expect(result).toHaveLength(2);
    });
  });

  describe("calculateRecommendedMeal()", () => {
    it("returns first item name from filtered list", () => {
      const service = menuService as any;
      const items = [
        { name: "First", price: 50, category: "polévka" },
        { name: "Second", price: 100, category: "hlavní jídlo" }
      ];
      
      const result = service.calculateRecommendedMeal(items);
      
      expect(result).toBe("First");
    });

    it("returns null when filtered list is empty", () => {
      const service = menuService as any;
      const items: any[] = [];
      
      const result = service.calculateRecommendedMeal(items);
      
      expect(result).toBeNull();
    });
  });

  describe("summarize() - integration", () => {
    it("returns menu with extracted data", async () => {
      const result = await menuService.summarize({
        url: "https://test-restaurace.cz",
        date: "2025-11-24"
      });

      expect(result).toHaveProperty("restaurant_name", "Test Restaurant");
      expect(result).toHaveProperty("date", "2025-11-24");
      expect(result).toHaveProperty("day_of_week", "Pondělí");
      expect(result).toHaveProperty("menu_items");
      expect(result).toHaveProperty("daily_menu", true);
      expect(result).toHaveProperty("recommendedMeal", null);
    });

    it("applies preferences filter when provided", async () => {
      const result = await menuService.summarize({
        url: "https://test-restaurace-prefs.cz",
        date: "2025-11-24",
        preferences: {
          price: 100,
          allergens: [1, 3]
        }
      });

      // Should filter out "Řízek" (has allergen 1,3) and keep "Polévka"
      expect(result.menu_items).toHaveLength(1);
      expect(result.menu_items[0].name).toBe("Polévka");
      expect(result).toHaveProperty("recommendedMeal", "Polévka");
    });

    it("returns no_daily_menu status when pre-check fails", async () => {
      mockedScrape.mockResolvedValue({
        html: "<html><body><h1>Jídelní lístek</h1><p>Stálá nabídka</p></body></html>",
        text: "Úvod Kontakty O nás Rezervace Jídelní lístek"
      });

      const result = await menuService.summarize({
        url: "https://alacarte-only.cz",
        date: "2025-11-24"
      });

      expect(result).toHaveProperty("daily_menu", false);
      expect(result.menu_items).toEqual([]);
      expect(mockedExtractMenu).not.toHaveBeenCalled();
    });

    it("throws validation error for invalid URL", async () => {
      await expect(
        menuService.summarize({
          url: "ftp://invalid.cz",
          date: "2025-11-24"
        })
      ).rejects.toThrow();
    });

    it("throws validation error for invalid date", async () => {
      await expect(
        menuService.summarize({
          url: "https://test.cz",
          date: "2025-13-45"
        })
      ).rejects.toThrow();
    });
  });
});

