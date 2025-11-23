import request from "supertest";
import express from "express";
import summarizeRouter from "../../src/routes/summarize.route";
import { cacheService } from "../../src/services/cache";
import * as scraperService from "../../src/services/scraper";
import * as llmService from "../../src/services/llm";
import * as fs from "fs";
import * as path from "path";

jest.mock("../../src/services/scraper");
jest.mock("../../src/services/llm");

const mockedScrape = scraperService.scrape as jest.MockedFunction<typeof scraperService.scrape>;
const mockedExtractMenu = llmService.extractMenu as jest.MockedFunction<typeof llmService.extractMenu>;

describe("Integration: POST /api/summarize - Czech Data", () => {
  let app: express.Application;
  const testDbPath = path.join(process.cwd(), "test-cache.db");

  beforeAll(async () => {
    await cacheService.init("test-cache.db");

    app = express();
    app.use(express.json());
    app.use("/api", summarizeRouter);
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
      html: "<html><body><h1>Jídelní lístek</h1><p>Polévka 45,-</p></body></html>",
      text: "Jídelní lístek Polévka 45,-"
    });

    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Polévka", price: 45 }]
    });
  });

  it("returns fresh Czech menu data on first call", async () => {
    const requestBody = {
      url: "https://restaurace-praha.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("source", "fresh");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toEqual({
      items: [{ name: "Polévka", price: 45 }]
    });
    expect(mockedScrape).toHaveBeenCalledWith("https://restaurace-praha.cz");
    expect(mockedExtractMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Jídelní lístek"),
        text: expect.stringContaining("Polévka"),
        url: "https://restaurace-praha.cz"
      })
    );
  });

  it("caches Czech menu result", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [
        { name: "Hovězí vývar", price: 45 },
        { name: "Svíčková", price: 145 }
      ]
    });

    const requestBody = {
      url: "https://ceska-hospoda.cz",
      date: "2025-11-23"
    };

    await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    const cached = await cacheService.getCachedMenu(
      "https://ceska-hospoda.cz",
      "2025-11-23"
    );
    expect(cached).toEqual({
      items: [
        { name: "Hovězí vývar", price: 45 },
        { name: "Svíčková", price: 145 }
      ]
    });
    expect(cached.items[0].name).toBe("Hovězí vývar");
  });

  it("second call returns cached Czech menu with source: cache", async () => {
    const requestBody = {
      url: "https://restaurant-u-fleku.cz",
      date: "2025-11-23"
    };

    await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    jest.clearAllMocks();

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("source", "cache");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toEqual({
      items: [{ name: "Polévka", price: 45 }]
    });
    
    expect(mockedScrape).not.toHaveBeenCalled();
    expect(mockedExtractMenu).not.toHaveBeenCalled();
  });

  it("validation error when url missing", async () => {
    const requestBody = {
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/urlEmpty");
    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toContain("url");
  });

  it("validation error when date has bad format", async () => {
    const requestBody = {
      url: "https://restaurace.cz",
      date: "23.11.2025"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/invalidDateFormat");
    expect(response.body.message).toContain("YYYY-MM-DD");
  });

  it("validation error when date is invalid", async () => {
    const requestBody = {
      url: "https://restaurace.cz",
      date: "2025-13-45"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/invalidDateFormat");
    expect(response.body.message).toContain("YYYY-MM-DD");
  });

  it("handles multiple Czech restaurants with different menus", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Guláš", price: 135 }]
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
      .send(request1)
      .expect(200);

    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Vepřové s knedlíky", price: 125 }]
    });

    const response2 = await request(app)
      .post("/api/summarize")
      .send(request2)
      .expect(200);

    expect(response1.body.data.items[0].name).toBe("Guláš");
    expect(response2.body.data.items[0].name).toBe("Vepřové s knedlíky");
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
      .send(requestBody)
      .expect(502);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/scraper/fetchFailed");
    expect(response.body.message).toContain("Failed to fetch URL");
  });

  it("validation error when url does not start with http or https", async () => {
    const requestBody = {
      url: "ftp://restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/invalidUrlFormat");
    expect(response.body.message).toBe("url must be a valid HTTP/HTTPS URL");
  });

  it("validation error for javascript: URL scheme", async () => {
    const requestBody = {
      url: "javascript:alert('xss')",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/invalidUrlFormat");
    expect(response.body.message).toBe("url must be a valid HTTP/HTTPS URL");
  });

  it("validation error for URL without protocol", async () => {
    const requestBody = {
      url: "restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/invalidUrlFormat");
    expect(response.body.message).toBe("url must be a valid HTTP/HTTPS URL");
  });

  it("accepts valid http URL", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Polévka", price: 45 }]
    });

    const requestBody = {
      url: "http://restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("source");
    expect(response.body).toHaveProperty("data");
  });

  it("accepts valid https URL", async () => {
    mockedExtractMenu.mockResolvedValue({
      items: [{ name: "Polévka", price: 45 }]
    });

    const requestBody = {
      url: "https://secure-restaurace.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("source");
    expect(response.body).toHaveProperty("data");
  });

  it("handles array of 2 URLs and returns array of results", async () => {
    mockedScrape
      .mockResolvedValueOnce({
        html: "<p>Restaurace 1</p>",
        text: "Restaurace 1"
      })
      .mockResolvedValueOnce({
        html: "<p>Restaurace 2</p>",
        text: "Restaurace 2"
      });

    mockedExtractMenu
      .mockResolvedValueOnce({
        items: [{ name: "Polévka 1", price: 45 }]
      })
      .mockResolvedValueOnce({
        items: [{ name: "Polévka 2", price: 55 }]
      });

    const requestBody = {
      url: ["https://restaurace1.cz", "https://restaurace2.cz"],
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("source", "fresh");
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("url", "https://restaurace1.cz");
    expect(response.body.data[0]).toHaveProperty("items");
    expect(response.body.data[0].items[0]).toHaveProperty("name", "Polévka 1");
    expect(response.body.data[1]).toHaveProperty("url", "https://restaurace2.cz");
    expect(response.body.data[1].items[0]).toHaveProperty("name", "Polévka 2");
  });

  it("invalid URL inside array returns 400 with correct error code", async () => {
    const requestBody = {
      url: ["https://restaurace1.cz", "invalid-url"],
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/invalidUrlFormat");
    expect(response.body).toHaveProperty("message");
  });

  it("empty array returns 400 with correct error code", async () => {
    const requestBody = {
      url: [],
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(400);

    expect(response.body).toHaveProperty("error", "restaurantMenuSummarizer/validation/invalidUrlArray");
    expect(response.body).toHaveProperty("message");
  });

  it("mixture of cache and fresh returns source mixed", async () => {
    await cacheService.saveMenuToCache(
      "https://cached-restaurace.cz",
      "2025-11-23",
      { items: [{ name: "Cached Polévka", price: 40 }] }
    );

    mockedScrape.mockResolvedValueOnce({
      html: "<p>Fresh restaurace</p>",
      text: "Fresh restaurace"
    });

    mockedExtractMenu.mockResolvedValueOnce({
      items: [{ name: "Fresh Polévka", price: 50 }]
    });

    const requestBody = {
      url: ["https://cached-restaurace.cz", "https://fresh-restaurace.cz"],
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(200);

    expect(response.body).toHaveProperty("source", "mixed");
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("url", "https://cached-restaurace.cz");
    expect(response.body.data[0].items[0]).toHaveProperty("name", "Cached Polévka");
    expect(response.body.data[1]).toHaveProperty("url", "https://fresh-restaurace.cz");
    expect(response.body.data[1].items[0]).toHaveProperty("name", "Fresh Polévka");
  });
});
