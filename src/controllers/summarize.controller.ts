import { Request, Response } from "express";
import { scrape } from "../services/scraper";
import { extractMenu } from "../services/llm";
import { cacheService } from "../services/cache";

/**
 * Request body interface for the summarize endpoint
 */
interface SummarizeRequest {
  url: string;
  date: string;
  preferences?: any;
}

/**
 * Validate that a string is in YYYY-MM-DD format
 */
function isValidDateFormat(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) {
    return false;
  }
  
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
}

/**
 * Validate that a URL is a valid HTTP/HTTPS URL
 */
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

/**
 * Handler for POST /api/summarize
 * Orchestrates scraping, LLM extraction, and caching of restaurant menus.
 * 
 * @param req - Express request object
 * @param res - Express response object
 */
export async function handleSummarize(req: Request, res: Response): Promise<void> {
  try {
    // Extract and validate input
    const { url, date, preferences }: SummarizeRequest = req.body;

    // Validation: url must be a non-empty string
    if (!url || url.trim().length === 0) {
      res.status(400).json({
        error: "Invalid input",
        message: "url must be a non-empty string"
      });
      return;
    }

    // Validation: date must be a non-empty string in YYYY-MM-DD format
    if (!date || date.trim().length === 0) {
      res.status(400).json({
        error: "Invalid input",
        message: "date must be a non-empty string"
      });
      return;
    }

    if (!isValidDateFormat(date)) {
      res.status(400).json({
        error: "Invalid input",
        message: "date must be in YYYY-MM-DD format"
      });
      return;
    }

    if (!isValidUrl(url)) {
      res.status(400).json({
        error: "Invalid input",
        message: "url must be a valid HTTP/HTTPS URL"
      });
      return;
    }

    // TODO: Handle url as string[] for multiple restaurants
    // TODO: Validate preferences schema when implemented

    // Step 1: Check cache
    const cachedResult = await cacheService.getCachedMenu(url, date);
    
    if (cachedResult) {
      // Cache HIT - return cached data
      res.status(200).json({
        source: "cache",
        data: cachedResult
      });
      return;
    }

    // Step 2: Cache MISS - scrape the website
    const scraped = await scrape(url);

    // Step 3: Extract menu using LLM
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

    res.status(200).json({
      source: "fresh",
      data: menuResponse
    });

  } catch (error) {
    // Log error for debugging
    console.error("Error in handleSummarize:", error);

    // Return 500 with error message
    if (error instanceof Error) {
      res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: "An unknown error occurred"
      });
    }
  }
}

