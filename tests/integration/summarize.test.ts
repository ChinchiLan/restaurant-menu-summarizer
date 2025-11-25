import request from "supertest";
import express from "express";
import summarizeRouter from "../../src/routes/summarize.route";
import { cacheService } from "../../src/services/cache.service";
import { scraperService } from "../../src/services/scraper.service";
import { llmService } from "../../src/services/llm.service";
import * as fs from "fs";
import * as path from "path";

jest.mock("../../src/services/scraper.service");
jest.mock("../../src/services/llm.service");

const mockedScrape = scraperService.scrape as jest.MockedFunction<typeof scraperService.scrape>;
const mockedExtractMenu = llmService.extractMenu as jest.MockedFunction<typeof llmService.extractMenu>;
const mockedExtractRestaurantName = llmService.extractRestaurantName as jest.MockedFunction<typeof llmService.extractRestaurantName>;

describe("Integration: POST /api/summarize - Czech Data", () => {
  let app: express.Application;
  const testDbPath = path.join(process.cwd(), "test-cache.db");
  const TEST_API_KEY = "test-api-key-12345";

  beforeAll(async () => {
    // Set API key for tests
    process.env.API_KEY = TEST_API_KEY;
    
    await cacheService.init("test-cache.db");

    app = express();
    app.use(express.json({ limit: "2mb" }));
    app.use("/api", summarizeRouter);
    
    // Import and register error handler (must be last)
    const { errorHandler } = require("../../src/middleware/error.middleware");
    app.use(errorHandler);
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
      html: "<html><body><h1>Denní menu</h1><h2>Pondělí</h2><p>Polévka 45 Kč</p><p>Hlavní jídlo: Smažený řízek 120 Kč</p></body></html>",
      text: "Denní menu Pondělí Polévka 45 Kč Hlavní jídlo: Smažený řízek 120 Kč"
    });

    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Polévka", price: 45, category: "polévka" }]
    });

    mockedExtractRestaurantName.mockResolvedValue("Test Restaurant");
  });

  it("returns fresh Czech menu data on first call", async () => {
    const requestBody = {
      url: "https://restaurace-praha.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("restaurant_name");
    expect(response.body).toHaveProperty("date", "2025-11-23");
    expect(response.body).toHaveProperty("day_of_week", "Neděle");
    expect(response.body).toHaveProperty("menu_items");
    expect(response.body).toHaveProperty("recommendedMeal");
    expect(response.body.menu_items).toEqual([
      { name: "Polévka", price: 45, category: "polévka" }
    ]);
    expect(mockedScrape).toHaveBeenCalledWith("https://restaurace-praha.cz");
    expect(mockedExtractMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Denní menu"),
        text: expect.stringContaining("Polévka"),
        url: "https://restaurace-praha.cz",
        day: "Neděle"
      })
    );
  });

  it("caches Czech menu result", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [
        { name: "Hovězí vývar", price: 45, category: "polévka" },
        { name: "Svíčková", price: 145, category: "hlavní jídlo" }
      ]
    });

    const requestBody = {
      url: "https://ceska-hospoda.cz",
      date: "2025-11-23"
    };

    await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    const cached = await cacheService.getCachedMenu(
      "https://ceska-hospoda.cz",
      "2025-11-23"
    );
    expect(cached).toHaveProperty("restaurant_name");
    expect(cached).toHaveProperty("date", "2025-11-23");
    expect(cached).toHaveProperty("day_of_week", "Neděle");
    expect(cached).toHaveProperty("menu_items");
    expect(cached.menu_items[0].name).toBe("Hovězí vývar");
    expect(cached.menu_items[1].name).toBe("Svíčková");
  });

  it("second call returns cached Czech menu", async () => {
    const requestBody = {
      url: "https://restaurant-u-fleku.cz",
      date: "2025-11-23"
    };

    await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    jest.clearAllMocks();

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    expect(response.body.menu_items).toEqual([
      { name: "Polévka", price: 45, category: "polévka" }
    ]);
    
    expect(mockedScrape).not.toHaveBeenCalled();
    expect(mockedExtractMenu).not.toHaveBeenCalled();
  });

  it("validation error when url missing", async () => {
    const requestBody = {
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/validation/urlEmpty");
    expect(response.body.error).toHaveProperty("message");
    expect(response.body.error.message).toContain("url");
  });

  it("validation error when date has bad format", async () => {
    const requestBody = {
      url: "https://restaurace.cz",
      date: "23.11.2025"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/validation/invalidDateFormat");
    expect(response.body.error.message).toContain("YYYY-MM-DD");
  });

  it("validation error when date is invalid", async () => {
    const requestBody = {
      url: "https://restaurace.cz",
      date: "2025-13-45"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/validation/invalidDateFormat");
    expect(response.body.error.message).toContain("YYYY-MM-DD");
  });

  it("handles multiple Czech restaurants with different menus", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Guláš", price: 135, category: "hlavní jídlo" }]
    });

    const request1 = {
      url: "https://hospoda-na-rohu.cz",
      date: "2025-11-23"
    };

    const request2 = {
      url: "https://restaurace-u-krale.cz",
      date: "2025-11-23"
    };

    const response1 = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(request1)
      .expect(200);

    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Vepřové s knedlíky", price: 125, category: "hlavní jídlo" }]
    });

    const response2 = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(request2)
      .expect(200);

    expect(response1.body.menu_items[0].name).toBe("Guláš");
    expect(response2.body.menu_items[0].name).toBe("Vepřové s knedlíky");
  });

  it("returns 502 when scraper fails for Czech URL", async () => {
    const { ScraperErrors } = require("../../src/errors");
    mockedScrape.mockRejectedValue(
      new ScraperErrors.FetchFailedError({ url: "https://neexistuje.cz" })
    );

    const requestBody = {
      url: "https://neexistuje.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(502);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/scraper/fetchFailed");
    expect(response.body.error.message).toContain("Failed to fetch URL");
  });

  it("validation error when url does not start with http or https", async () => {
    const requestBody = {
      url: "ftp://restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/validation/invalidUrlFormat");
    expect(response.body.error.message).toBe("url must be a valid HTTP/HTTPS URL");
  });

  it("validation error for javascript: URL scheme", async () => {
    const requestBody = {
      url: "javascript:alert('xss')",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/validation/invalidUrlFormat");
    expect(response.body.error.message).toBe("url must be a valid HTTP/HTTPS URL");
  });

  it("validation error for URL without protocol", async () => {
    const requestBody = {
      url: "restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/validation/invalidUrlFormat");
    expect(response.body.error.message).toBe("url must be a valid HTTP/HTTPS URL");
  });

  it("accepts both http and https URLs", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Polévka", price: 45, category: "polévka" }]
    });

    // Test HTTP
    const httpBody = {
      url: "http://restaurace.cz",
      date: "2025-11-23"
    };

    const httpResponse = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(httpBody)
      .expect(200);

    expect(httpResponse.body).toHaveProperty("menu_items");

    // Test HTTPS
    const httpsBody = {
      url: "https://secure-restaurace.cz",
      date: "2025-11-23"
    };

    const httpsResponse = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(httpsBody)
      .expect(200);

    expect(httpsResponse.body).toHaveProperty("menu_items");
  });

  it("filters menu items by preferences and returns recommendedMeal", async () => {
    mockedScrape
    mockedExtractMenu.mockResolvedValue({
      items: [
        { name: "Hovězí vývar", price: 45, allergens: ["1", "3"], category: "polévka" },
        { name: "Svíčková", price: 145, allergens: ["1", "7"], category: "hlavní jídlo" },
        { name: "Guláš", price: 135, allergens: null, category: "hlavní jídlo" },
        { name: "Dezert", price: 85, allergens: ["7"], category: "dezert" }
      ]
    });
    mockedExtractRestaurantName.mockResolvedValue("Test Restaurace");

    const requestBody = {
      url: "https://restaurace.cz",
      date: "2025-11-23",
      preferences: {
        price: 150,
        allergens: [7]
      }
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    // Should filter out items with allergen 7 (Svíčková, Dezert)
    // Should keep items with price <= 150 and no allergen 7
    expect(response.body).toHaveProperty("menu_items");
    expect(response.body.menu_items).toHaveLength(2);
    expect(response.body.menu_items[0]).toHaveProperty("name", "Hovězí vývar");
    expect(response.body.menu_items[1]).toHaveProperty("name", "Guláš");
    
    // recommendedMeal should be first matching item
    expect(response.body).toHaveProperty("recommendedMeal", "Hovězí vývar");
  });

  it("returns null recommendedMeal when no preferences provided", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Polévka", price: 45, category: "polévka" }]
    });
    mockedExtractRestaurantName.mockResolvedValue("Test Restaurace");

    const requestBody = {
      url: "https://no-prefs-restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("recommendedMeal", null);
  });

  it("filters items by price only", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [
        { name: "Cheap", price: 50, allergens: null, category: "polévka" },
        { name: "Expensive", price: 200, allergens: null, category: "hlavní jídlo" }
      ]
    });
    mockedExtractRestaurantName.mockResolvedValue("Test Restaurace");

    const requestBody = {
      url: "https://price-test-restaurace.cz",
      date: "2025-11-23",
      preferences: {
        price: 100,
        allergens: []
      }
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    expect(response.body.menu_items).toHaveLength(1);
    expect(response.body.menu_items[0]).toHaveProperty("name", "Cheap");
    expect(response.body).toHaveProperty("recommendedMeal", "Cheap");
  });

  // Auth tests
  it("returns 401 when API key is missing", async () => {
    const requestBody = {
      url: "https://restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(401);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/auth/apiKeyMissing");
    expect(response.body.error).toHaveProperty("message", "API key is required");
  });

  it("returns 401 when API key is invalid", async () => {
    const requestBody = {
      url: "https://restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', 'wrong-api-key')
      .send(requestBody)
      .expect(401);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toHaveProperty("code", "restaurantMenuSummarizer/auth/unauthorized");
    expect(response.body.error).toHaveProperty("message", "Invalid or missing API key");
  });

  it("accepts valid API key via Authorization Bearer header", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Polévka", price: 45, category: "polévka" }]
    });
    mockedExtractRestaurantName.mockResolvedValue("Test Restaurace");

    const requestBody = {
      url: "https://auth-test-restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('Authorization', `Bearer ${TEST_API_KEY}`)
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("menu_items");
  });

  it("skips LLM extraction for à la carte menu (no daily menu indicators)", async () => {
    // Mock page that contains ONLY à la carte menu (no daily menu keywords)
    mockedScrape.mockResolvedValue({
      html: "<html><body><h1>Jídelní lístek</h1><h2>Stálá nabídka</h2><p>Polévka 45,-</p><p>Hlavní jídlo 150,-</p></body></html>",
      text: "Jídelní lístek Stálá nabídka Polévka 45,- Hlavní jídlo 150,-"
    });

    mockedExtractRestaurantName.mockResolvedValue("À la Carte Restaurant");

    const requestBody = {
      url: "https://alacarte-restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    // Should return empty menu with no_daily_menu status
    expect(response.body).toHaveProperty("restaurant_name", "À la Carte Restaurant");
    expect(response.body).toHaveProperty("menu_items", []);
    expect(response.body).toHaveProperty("daily_menu", false);
    expect(response.body).toHaveProperty("recommendedMeal", null);

    // LLM menu extraction should NOT have been called (cost-saving)
    expect(mockedExtractMenu).not.toHaveBeenCalled();

    // But restaurant name extraction should still be called
    expect(mockedExtractRestaurantName).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://alacarte-restaurace.cz"
      })
    );
  });

  it("returns no_daily_menu status when LLM extracts empty menu", async () => {
    // LLM successfully runs but returns no items (e.g., page says "no daily menu today")
    mockedExtractMenu.mockResolvedValue({
      items: []
    });
    mockedExtractRestaurantName.mockResolvedValue("Test Restaurant");

    const requestBody = {
      url: "https://no-menu-today.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("daily_menu", false);
    expect(response.body.menu_items).toEqual([]);
    expect(mockedExtractMenu).toHaveBeenCalled(); // LLM WAS called this time
  });

  it("filters items with only allergen preferences (no price)", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [
        { name: "Safe", price: 100, allergens: null, category: "polévka" },
        { name: "Unsafe", price: 100, allergens: ["7"], category: "hlavní jídlo" }
      ]
    });
    mockedExtractRestaurantName.mockResolvedValue("Test Restaurace");

    const requestBody = {
      url: "https://allergen-test.cz",
      date: "2025-11-23",
      preferences: {
        allergens: [7]
      }
    };

    const response = await request(app)
      .post("/api/summarize")
      .set('x-api-key', TEST_API_KEY)
      .send(requestBody)
      .expect(200);

    expect(response.body.menu_items).toHaveLength(1);
    expect(response.body.menu_items[0].name).toBe("Safe");
    expect(response.body.recommendedMeal).toBe("Safe");
  });
});
