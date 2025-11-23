import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../utils/logger";
import { ScraperErrors } from "../errors";

export async function scrape(url: string): Promise<{ html: string; text: string }> {
  try {
    logger.info("SCRAPER", "Fetch started", { url });

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;

    if (!html || html.trim().length === 0) {
      logger.warn("SCRAPER", "Empty HTML response", { url });
      throw new ScraperErrors.HtmlEmptyError({ url });
    }

    logger.info("SCRAPER", "Fetch successful", { url, size: html.length });

    const $ = cheerio.load(html);

    $("script, style, noscript, iframe").remove();

    const text = $("body").text().replace(/\s+/g, " ").trim();

    // TODO: Add fallback LLM fetch if text extraction is insufficient
    // TODO: Add support for JavaScript-rendered content (Puppeteer/Playwright)
    // TODO: Add retry logic with exponential backoff

    return {
      html,
      text
    };

  } catch (error) {
    if (error instanceof ScraperErrors.HtmlEmptyError) {
      throw error;
    }
    
    if (axios.isAxiosError(error)) {
      logger.error("SCRAPER", "Fetch failed", { url, reason: error.message });
      throw new ScraperErrors.FetchFailedError({ url, reason: error.message });
    }

    logger.error("SCRAPER", "Unexpected error", { url });
    throw new ScraperErrors.FetchFailedError({ url });
  }
}
