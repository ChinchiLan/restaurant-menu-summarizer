import { Request, Response } from "express";
import { scrape } from "../services/scraper";
import { extractMenu, MenuResponse } from "../services/llm";
import { cacheService } from "../services/cache";
import { logger } from "../utils/logger";
import { ValidationErrors, ScraperErrors, LLMErrors, MenuSchemaErrors, CacheErrors, BaseAppError } from "../errors";

interface SummarizeRequest {
  url: string | string[];
  date: string;
  preferences?: any;
}

function isValidDateFormat(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) {
    return false;
  }
  
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
}

function isValidUrl(url: string): boolean {
  const trimmed = url.trim();
  
  if (trimmed.length === 0) {
    return false;
  }
  
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return false;
  }
  
  return true;
}

function validateUrlArray(urls: string[]): void {
  if (urls.length === 0) {
    throw new ValidationErrors.InvalidUrlArrayError({ reason: "Array is empty" });
  }

  for (const url of urls) {
    if (typeof url !== "string" || url.trim().length === 0) {
      throw new ValidationErrors.InvalidUrlArrayError({ reason: "Array contains non-string or empty values" });
    }
    
    if (!isValidUrl(url)) {
      throw new ValidationErrors.InvalidUrlFormatError({ url });
    }
  }
}

async function processSingleUrl(url: string, date: string): Promise<{ data: MenuResponse; fromCache: boolean }> {
  const cachedResult = await cacheService.getCachedMenu(url, date);
  
  if (cachedResult) {
    logger.info("SUMMARIZE", "Cache hit", { url, date });
    return { data: cachedResult, fromCache: true };
  }

  logger.info("SUMMARIZE", "Scraper started", { url });
  const scraped = await scrape(url);

  logger.info("SUMMARIZE", "LLM extraction started", { url });
  const menuResponse = await extractMenu({
    html: scraped.html,
    text: scraped.text,
    url: url
  });

    // TODO: Apply user preferences to filter/rank menu items
    // TODO: Merge multiple restaurant menus if url was an array
    // TODO: Add nutritional info enrichment
    // TODO: Add recommendation scoring based on preferences

  await cacheService.saveMenuToCache(url, date, menuResponse);

  logger.info("SUMMARIZE", "Request successful", { url, date, items: menuResponse.items.length });

  return { data: menuResponse, fromCache: false };
}

export async function handleSummarize(req: Request, res: Response): Promise<void> {
  try {
    const { url, date, preferences }: SummarizeRequest = req.body;

    if (!date || date.trim().length === 0) {
      throw new ValidationErrors.DateEmptyError();
    }

    if (!isValidDateFormat(date)) {
      throw new ValidationErrors.InvalidDateFormatError({ date });
    }

    // Handle array of URLs
    if (Array.isArray(url)) {
      validateUrlArray(url);

      const results: Array<{ url: string; items: any[]; fromCache: boolean }> = [];

      for (const singleUrl of url) {
        logger.info("SUMMARIZE", "Processing URL in array", { url: singleUrl });
        const result = await processSingleUrl(singleUrl, date);
        results.push({
          url: singleUrl,
          items: result.data.items,
          fromCache: result.fromCache
        });
      }

      const allFromCache = results.every(r => r.fromCache);
      const allFresh = results.every(r => !r.fromCache);
      
      let source: "cache" | "fresh" | "mixed";
      if (allFromCache) {
        source = "cache";
      } else if (allFresh) {
        source = "fresh";
      } else {
        source = "mixed";
      }

      res.status(200).json({
        source,
        data: results.map(r => ({ url: r.url, items: r.items }))
      });
      return;
    }

    // Handle single URL (existing behavior)
    if (!url || url.trim().length === 0) {
      throw new ValidationErrors.UrlEmptyError();
    }

    if (!isValidUrl(url)) {
      throw new ValidationErrors.InvalidUrlFormatError({ url });
    }

    const result = await processSingleUrl(url, date);

    res.status(200).json({
      source: result.fromCache ? "cache" : "fresh",
      data: result.data
    });

  } catch (error) {
    if (error instanceof BaseAppError) {
      logger.error("SUMMARIZE", error);
      
      if (error instanceof ValidationErrors.UrlEmptyError ||
          error instanceof ValidationErrors.DateEmptyError ||
          error instanceof ValidationErrors.InvalidDateFormatError ||
          error instanceof ValidationErrors.InvalidUrlFormatError ||
          error instanceof ValidationErrors.InvalidUrlArrayError) {
        res.status(400).json({
          error: error.code,
          message: error.message
        });
      } else if (error instanceof ScraperErrors.FetchFailedError ||
                 error instanceof ScraperErrors.HtmlEmptyError) {
        res.status(502).json({
          error: error.code,
          message: error.message
        });
      } else {
        res.status(500).json({
          error: error.code,
          message: error.message
        });
      }
    } else if (error instanceof Error) {
      logger.error("SUMMARIZE", error.message);
      res.status(500).json({
        error: "INTERNAL_ERROR",
        message: error.message
      });
    } else {
      logger.error("SUMMARIZE", "Unknown error");
      res.status(500).json({
        error: "UNKNOWN_ERROR",
        message: "An unknown error occurred"
      });
    }
  }
}
