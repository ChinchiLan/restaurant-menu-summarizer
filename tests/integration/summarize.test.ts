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

    expect(response.body).toHaveProperty("error", "Invalid input");
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

    expect(response.body).toHaveProperty("error", "Invalid input");
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

    expect(response.body).toHaveProperty("error", "Invalid input");
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

  it("returns 500 when scraper fails for Czech URL", async () => {
    mockedScrape.mockRejectedValue(
      new Error("Failed to fetch URL: https://neexistuje.cz")
    );

    const requestBody = {
      url: "https://neexistuje.cz",
      date: "2025-11-23"
    };

    const response = await request(app)
      .post("/api/summarize")
      .send(requestBody)
      .expect(500);

    expect(response.body).toHaveProperty("error", "Internal server error");
    expect(response.body.message).toContain("Failed to fetch URL");
  });
});
