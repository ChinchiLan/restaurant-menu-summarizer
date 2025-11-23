import axios from "axios";
import { scrape } from "../../src/services/scraper";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Scraper Service - Czech Data", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return html and text for a simple Czech HTML page", async () => {
    const mockHtml = "<html><body><h1>Jídelní lístek</h1><p>Polévka 45,-</p></body></html>";
    mockedAxios.get.mockResolvedValue({ data: mockHtml });

    const result = await scrape("https://restaurace.cz");

    expect(result).toHaveProperty("html");
    expect(result).toHaveProperty("text");
    expect(result.html).toBe(mockHtml);
    expect(result.text).toContain("Jídelní lístek");
    expect(result.text).toContain("Polévka 45,-");
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://restaurace.cz",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.any(String)
        }),
        timeout: 10000
      })
    );
  });

  it("should throw an error if axios fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    await expect(scrape("https://restaurace.cz")).rejects.toThrow(
      "Failed to fetch URL: https://restaurace.cz"
    );
  });

  it("should throw if HTML is empty", async () => {
    mockedAxios.get.mockResolvedValue({ data: "" });

    await expect(scrape("https://restaurace.cz")).rejects.toThrow(
      "Empty HTML response"
    );
  });

  it("should extract Czech menu items correctly", async () => {
    const mockHtml = `
      <html>
        <body>
          <h1>Denní menu</h1>
          <div class="menu">
            <p>Polévka: Hovězí vývar s nudlemi 45,-</p>
            <p>Hlavní jídlo: Svíčková na smetaně 145,-</p>
            <p>Dezert: Palačinky s marmeládou 65,-</p>
          </div>
        </body>
      </html>
    `;
    mockedAxios.get.mockResolvedValue({ data: mockHtml });

    const result = await scrape("https://restaurace.cz");

    expect(result.text).toContain("Denní menu");
    expect(result.text).toContain("Hovězí vývar");
    expect(result.text).toContain("Svíčková na smetaně");
    expect(result.text).toContain("Palačinky");
    expect(result.text).toContain("145,-");
  });
});
