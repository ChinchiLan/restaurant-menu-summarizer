import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../utils/logger";
import { ScraperErrors } from "../errors";
import { LOG_SOURCES, LOG_MESSAGES } from "../constants/log";

export class ScraperService {
  async scrape(url: string): Promise<{ html: string; text: string }> {
    try {
      logger.info(LOG_SOURCES.SCRAPER, LOG_MESSAGES.FETCH_STARTED, { url });

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const html = response.data;

      if (!html || html.trim().length === 0) {
        logger.warn(LOG_SOURCES.SCRAPER, LOG_MESSAGES.EMPTY_HTML_RESPONSE, { url });
        throw new ScraperErrors.HtmlEmptyError({ url });
      }

      logger.info(LOG_SOURCES.SCRAPER, LOG_MESSAGES.FETCH_SUCCESSFUL, { url, size: html.length });

      const $ = cheerio.load(html);

      $("script, style, noscript, iframe").remove();

      const text = $("body").text().replace(/\s+/g, " ").trim();

      return {
        html,
        text
      };

    } catch (error) {
      if (error instanceof ScraperErrors.HtmlEmptyError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        logger.error(LOG_SOURCES.SCRAPER, LOG_MESSAGES.FETCH_FAILED, { url, reason: error.message });
        throw new ScraperErrors.FetchFailedError({ url, reason: error.message });
      }

      logger.error(LOG_SOURCES.SCRAPER, LOG_MESSAGES.UNEXPECTED_ERROR, { url });
      throw new ScraperErrors.FetchFailedError({ url });
    }
  }
}

export const scraperService = new ScraperService();
