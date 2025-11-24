import { scraperService } from "./scraper.service";
import { llmService, MenuResponse, MenuItem } from "./llm.service";
import { cacheService } from "./cache.service";
import { logger } from "../utils/logger";
import { getCzechDayName } from "../utils/date";
import { ValidationErrors } from "../errors";
import { SummarizeInputSchema } from "../validators/summarize.schema";
import { z } from "zod";
import { LOG_SOURCES, LOG_MESSAGES } from "../constants/log";
import { SummarizeRequest, SummarizeResponse, RestaurantMenu } from "../types/api.types";

export class MenuService {
  /**
   * Main entry point for menu summarization
   * Validates input, extracts Czech day name, and orchestrates the extraction flow
   */
  async summarize(input: SummarizeRequest): Promise<SummarizeResponse> {
    // Validate input using Zod schema
    const parsedInput = SummarizeInputSchema.safeParse(input);

    if (!parsedInput.success) {
      // Convert Zod errors to our custom error classes
      this.mapZodErrorToCustomError(parsedInput.error, input);
    }

    const { url, date, preferences } = parsedInput.data;

    // Convert YYYY-MM-DD date to Czech weekday name (e.g., "Pondělí")
    const day = getCzechDayName(date);
    logger.info(LOG_SOURCES.SUMMARIZE, LOG_MESSAGES.DAY_EXTRACTED, { date, day });

    return await this.processUrl(url, date, day, preferences);
  }

  /**
   * Processes a single URL to extract menu
   * Checks cache first, falls back to scraping + LLM extraction
   * Applies preferences filtering if provided
   */
  private async processUrl(
    url: string, 
    date: string, 
    day: string, 
    preferences?: { price?: number; allergens?: number[] }
  ): Promise<RestaurantMenu> {
    // Try to get cached result first (performance optimization)
    const cachedResult = await cacheService.getCachedMenu(url, date);
    
    if (cachedResult) {
      logger.info(LOG_SOURCES.SUMMARIZE, LOG_MESSAGES.CACHE_HIT, { url, date });
      
      // If preferences provided, filter cached items and calculate recommendation
      if (preferences) {
        const filteredItems = this.applyPreferencesFilter(cachedResult.menu_items, preferences);
        const recommendedMeal = this.calculateRecommendedMeal(filteredItems);
        
        return {
          ...cachedResult,
          menu_items: filteredItems,
          recommendedMeal
        };
      }
      
      // No preferences - return cached data as-is
      return {
        ...cachedResult,
        recommendedMeal: null
      };
    }
    // Cache miss - need to scrape and extract fresh data
    logger.info(LOG_SOURCES.SUMMARIZE, LOG_MESSAGES.SCRAPER_STARTED, { url });
    const scraped = await scraperService.scrape(url);

    // Pre-check for daily menu indicators to avoid unnecessary LLM calls and save cost on non-menu pages
    if (!this.hasDailyMenuIndicators(scraped.text)) {
      logger.info(LOG_SOURCES.SUMMARIZE, LOG_MESSAGES.NO_DAILY_MENU_FOUND, { 
        url, 
        reason: "No daily menu indicators found in text" 
      });

      // Still extract restaurant name, but skip expensive LLM menu extraction
      const restaurantName = await llmService.extractRestaurantName({
        html: scraped.html,
        text: scraped.text,
        url: url
      });

      const emptyMenu: RestaurantMenu = {
        restaurant_name: restaurantName,
        date: date,
        day_of_week: day,
        menu_items: [],
        extraction_status: "no_daily_menu",
        recommendedMeal: null
      };

      await cacheService.saveMenuToCache(url, date, emptyMenu);
      return emptyMenu;
    }

    let menuResponse: MenuResponse;
    let restaurantName: string;
    let extractionStatus: "success" | "no_daily_menu";

    // Extract menu items and restaurant name using LLM
    logger.info(LOG_SOURCES.SUMMARIZE, LOG_MESSAGES.LLM_EXTRACTION_STARTED, { url });
    menuResponse = await llmService.extractMenu({
      html: scraped.html,
      text: scraped.text,
      url: url,
      day: day
    });

    restaurantName = await llmService.extractRestaurantName({
      html: scraped.html,
      text: scraped.text,
      url: url
    });

    // Determine if we found a daily menu or not
    if (menuResponse.items.length === 0) {
      extractionStatus = "no_daily_menu";
      logger.info(LOG_SOURCES.SUMMARIZE, LOG_MESSAGES.NO_DAILY_MENU_FOUND, { url });
    } else {
      extractionStatus = "success";
    }

    // Apply preferences filtering if provided, otherwise return all items
    const finalItems = preferences 
      ? this.applyPreferencesFilter(menuResponse.items, preferences)
      : menuResponse.items;
    
    // Calculate recommended meal only if preferences were applied
    const recommendedMeal = preferences 
      ? this.calculateRecommendedMeal(finalItems)
      : null;

    // Prepare the response with filtered items
    const restaurantMenu: RestaurantMenu = {
      restaurant_name: restaurantName,
      date: date,
      day_of_week: day,
      menu_items: finalItems,
      extraction_status: extractionStatus,
      recommendedMeal
    };

    // Important: Cache the ORIGINAL unfiltered menu so different preferences can reuse it
    const menuToCache: RestaurantMenu = {
      restaurant_name: restaurantName,
      date: date,
      day_of_week: day,
      menu_items: menuResponse.items,
      extraction_status: extractionStatus,
      recommendedMeal: null
    };

    await cacheService.saveMenuToCache(url, date, menuToCache);

    logger.info(LOG_SOURCES.SUMMARIZE, LOG_MESSAGES.REQUEST_SUCCESSFUL, { 
      url, 
      date, 
      items: finalItems.length 
    });

    return restaurantMenu;
  }

  /**
   * Filters menu items based on user preferences
   * - Price: excludes items above max price (or with missing price)
   * - Allergens: excludes items containing any excluded allergen numbers
   * - Items with null allergens are treated as safe (not excluded)
   */
  private applyPreferencesFilter(
    items: MenuItem[], 
    preferences: { price?: number; allergens?: number[] }
  ): MenuItem[] {
    return items.filter(item => {
      // Price filter: only applies if price preference is set
      if (preferences.price !== undefined) {
        if (item.price === undefined || item.price > preferences.price) {
          return false;
        }
      }

      // Allergen filter: only applies if allergen preferences are set
      if (preferences.allergens !== undefined && preferences.allergens.length > 0) {
        if (item.allergens && item.allergens.length > 0) {
          // Exclude if item contains ANY allergen from the excluded list
          const hasExcludedAllergen = item.allergens.some(allergen => 
            preferences.allergens!.includes(Number(allergen))
          );
          if (hasExcludedAllergen) {
            return false;
          }
        }
        // Note: null/undefined allergens are treated as safe
      }

      return true;
    });
  }

  /**
   * Returns the first item from filtered list as recommended meal
   * Returns null if no items match the preferences
   */
  private calculateRecommendedMeal(filteredItems: MenuItem[]): string | null {
    if (filteredItems.length === 0) {
      return null;
    }
    return filteredItems[0].name;
  }

  /**
   * Pre-check: Does the page contain a real daily menu?
   * Simple 3-step validation to avoid expensive LLM calls on non-menu pages
   */
  private hasDailyMenuIndicators(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Step 1: Find daily menu keyword
    const dailyKeywords = [
      "polední menu",
      "denní menu",
      "menu dne",
      "obědové menu",
      "týdenní menu"
    ];
    
    let keywordPosition = -1;
    for (const keyword of dailyKeywords) {
      const pos = lowerText.indexOf(keyword);
      if (pos !== -1) {
        keywordPosition = pos;
        break;
      }
    }
    
    // No keyword = definitely not a daily menu
    if (keywordPosition === -1) {
      return false;
    }
    
    // Step 2: Extract context around keyword (±400 chars)
    const contextStart = Math.max(0, keywordPosition - 400);
    const contextEnd = Math.min(lowerText.length, keywordPosition + 400);
    const context = lowerText.substring(contextStart, contextEnd);
    
    // Step 3: Reject navigation noise and require strong signal
    if (this.isMostlyNavigation(context)) {
      return false;
    }
    
    return this.hasStrongDailySignal(context);
  }
  
  /**
   * Check if context is mostly navigation/menu structure
   * (e.g., "Úvod / O nás / Kontakty / Jídelní lístek / Rezervace")
   */
  private isMostlyNavigation(context: string): boolean {
    const navKeywords = [
      "úvod",
      "kontakty",
      "o nás",
      "rezervace",
      "ubytování",
      "galerie",
      "akce",
      "reference"
    ];
    
    let navCount = 0;
    for (const keyword of navKeywords) {
      if (context.includes(keyword)) {
        navCount++;
      }
    }
    
    // If we see 3+ navigation keywords near the "polední menu" keyword,
    // it's likely just a navigation link, not actual menu content
    return navCount >= 3;
  }
  
  /**
   * Check for at least ONE strong signal that this is a real daily menu
   * (not just a navigation link)
   */
  private hasStrongDailySignal(context: string): boolean {
    // Signal 1: Czech weekday
    const weekdays = ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"];
    for (const weekday of weekdays) {
      if (context.includes(weekday)) {
        return true;
      }
    }
    
    // Signal 2: Date pattern
    const datePattern = /\d{1,2}\.\s?\d{1,2}\./; // 24.11. or 24. 11.
    if (datePattern.test(context)) {
      return true;
    }
    
    // Signal 3: Daily menu prices (60–200 Kč)
    const pricePattern = /\d{2,3}\s*(?:kč|,-)/gi;
    const prices = context.match(pricePattern);
    if (prices && prices.length >= 2) {
      // At least 2 prices found
      let validCount = 0;
      for (const price of prices) {
        const num = parseInt(price.replace(/[^\d]/g, ""), 10);
        if (num >= 60 && num <= 200) {
          validCount++;
        }
      }
      if (validCount >= 2) {
        return true;
      }
    }
    
    // Signal 4: Soup + main dish keywords
    const hasSoup = /polévka|vývar/.test(context);
    const hasMainDish = /řízek|svíčková|panenka|guláš|kuře/.test(context);
    if (hasSoup && hasMainDish) {
      return true;
    }
    
    // No strong signal found
    return false;
  }

  /**
   * Converts Zod validation errors to our custom error classes
   * This provides consistent error codes and messages across the API
   */
  private mapZodErrorToCustomError(error: z.ZodError, input: SummarizeRequest): never {
    const issues = error.issues;
    
    for (const issue of issues) {
      const path = issue.path.join(".");

      // URL validation errors
      if (path === "url") {
        if (issue.code === "too_small") {
          throw new ValidationErrors.UrlEmptyError();
        }
        
        if (issue.code === "custom") {
          // Custom refinement failed (e.g., not HTTP/HTTPS)
          throw new ValidationErrors.InvalidUrlFormatError({ url: input.url });
        }
      }

      // Date validation errors
      if (path === "date") {
        if (issue.code === "too_small") {
          throw new ValidationErrors.DateEmptyError();
        }
        
        if (issue.code === "custom" || issue.code === "invalid_type") {
          // Regex or refinement failed (e.g., wrong format or invalid date)
          throw new ValidationErrors.InvalidDateFormatError({ date: input.date });
        }
      }
    }

    // Fallback for unexpected validation errors
    throw new ValidationErrors.UrlEmptyError({ reason: "Unknown validation error" });
  }
}

export const menuService = new MenuService();
