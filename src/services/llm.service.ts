import OpenAI from "openai";
import type { Chat } from "openai/resources";
import {logger} from "../utils/logger";
import {LLMErrors, MenuSchemaErrors} from "../errors";
import {LOG_MESSAGES, LOG_SOURCES} from "../constants/log";
import {LLM_CONTENT_LIMITS, LLM_CONFIG} from "../constants/llm";
import {MENU_EXTRACTION_SYSTEM_PROMPT, buildMenuExtractionUserPrompt} from "../prompts/menu-extraction.prompt";
import {RESTAURANT_NAME_SYSTEM_PROMPT, buildRestaurantNameUserPrompt} from "../prompts/restaurant-name.prompt";

export type MenuItem = {
  name: string;
  price?: number;
  allergens?: string[] | null;
  weight?: string | null;
  category?: string;
};

export type MenuResponse = {
  items: MenuItem[];
};

type RawMenuItem = {
  name: string;
  price?: string | number | null;
  allergens?: string[];
  weight?: string;
  category?: string;
};

type RawMenuResponse = {
  items: RawMenuItem[];
};

export class LLMService {
  private getOpenAIClient(): OpenAI {
    if (!process.env.OPENAI_API_KEY) {
      throw new LLMErrors.ApiKeyMissingError();
    }
    
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Normalizes price from various formats to a number
   * Handles: "45,-", "45,50", "45.50", 45, null, undefined
   * Returns 0 for missing/invalid prices
   */
  normalizePrice(raw: string | number | null | undefined): number {
    if (raw === null || raw === undefined) {
      return 0;
    }
    
    if (typeof raw === "number") {
      return raw;
    }
    
    // Remove everything except digits, commas, and dots
    const cleaned = String(raw).replace(/[^\d,.]/g, "");
    // Convert Czech format (comma as decimal separator) to standard format
    const normalized = cleaned.replace(",", ".");
    const price = parseFloat(normalized);
    
    if (isNaN(price)) {
      return 0;
    }
    
    return price;
  }

  /**
   * Validates that LLM response matches expected schema
   * Checks for required fields: items array, name, category
   * Throws InvalidSchemaError if validation fails
   */
  private validateRawMenuResponse(parsed: unknown, url: string): void {
    // Basic type check
    if (typeof parsed !== "object" || parsed === null) {
      logger.error(LOG_SOURCES.LLM, LOG_MESSAGES.SCHEMA_VALIDATION_FAILED, { reason: "Response is not an object" });
      throw new MenuSchemaErrors.InvalidSchemaError({ reason: "Response is not an object", url });
    }
    
    // Check for items array
    if (!("items" in parsed) || !Array.isArray(parsed.items)) {
      logger.error(LOG_SOURCES.LLM, LOG_MESSAGES.SCHEMA_VALIDATION_FAILED, { reason: "Missing or invalid items array" });
      throw new MenuSchemaErrors.InvalidSchemaError({ reason: "Missing or invalid items array", url });
    }
    
    // Validate each item has required fields
    for (const item of parsed.items) {
      if (!item.name || typeof item.name !== "string" || item.name.trim().length === 0) {
        logger.error(LOG_SOURCES.LLM, LOG_MESSAGES.SCHEMA_VALIDATION_FAILED, { reason: "Invalid item name" });
        throw new MenuSchemaErrors.InvalidSchemaError({ reason: "Invalid item name", url });
      }
      
      if (!item.category || typeof item.category !== "string" || item.category.trim().length === 0) {
        logger.error(LOG_SOURCES.LLM, LOG_MESSAGES.SCHEMA_VALIDATION_FAILED, { reason: "Missing or invalid category" });
        throw new MenuSchemaErrors.InvalidSchemaError({ reason: "Missing or invalid category", url });
      }
    }
  }

  /**
   * Tool definition for price normalization (OpenAI function calling)
   */
  private getNormalizePriceTool() {
    return {
      type: "function" as const,
      function: {
        name: "normalizePrice",
        description: "Normalize Czech price format to a number. Handles formats like '145,-', '145 Kč', '145,50', '145.50' and converts them to numeric values.",
        parameters: {
          type: "object",
          properties: {
            raw: {
              type: "string",
              description: "Price string in Czech format (e.g., '145,-', '145 Kč', '145,50', '145.50')"
            }
          },
          required: ["raw"]
        }
      }
    };
  }

  /**
   * Step 1 of 2-step extraction pipeline: Extract raw menu items from HTML/text
   * Uses LLM with tool calling for price normalization
   * LLM can call normalizePrice tool to normalize prices during extraction
   */
  private async extractMenuRaw(content: { html: string; text: string; url: string; day: string }): Promise<RawMenuResponse> {
    const client = this.getOpenAIClient();

    logger.info(LOG_SOURCES.LLM, LOG_MESSAGES.EXTRACTION_STARTED, { url: content.url });
    logger.info(LOG_SOURCES.LLM, LOG_MESSAGES.DAY_PASSED_TO_LLM, { day: content.day, url: content.url });

    // Truncate content to stay within token limits
    const truncatedText = content.text.substring(0, LLM_CONTENT_LIMITS.MAX_MENU_TEXT_LENGTH);
    const truncatedHtml = content.html.substring(0, LLM_CONTENT_LIMITS.MAX_MENU_HTML_LENGTH);

    const messages: Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: MENU_EXTRACTION_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: buildMenuExtractionUserPrompt(content.day, content.url, truncatedText, truncatedHtml)
      }
    ];

    try {
      // Tool calling loop: LLM can call normalizePrice tool multiple times
      let maxIterations = 5; // Prevent infinite loops
      let finalResponse: any = null;

      while (maxIterations > 0) {
        const response = await client.chat.completions.create({
          model: LLM_CONFIG.MENU_EXTRACTION_MODEL,
          messages: messages,
          tools: [this.getNormalizePriceTool()],
          tool_choice: "auto", // Let LLM decide when to call the tool
          response_format: { type: "json_object" }, // Ensures structured JSON output
          temperature: LLM_CONFIG.TEMPERATURE
        });

        const message = response.choices[0].message;
        messages.push(message);

        // If LLM called a tool, execute it and add result to messages
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            if (toolCall.type === "function" && toolCall.function.name === "normalizePrice") {
              const args = JSON.parse(toolCall.function.arguments);
              const normalizedPrice = this.normalizePrice(args.raw);
              
              logger.debug(LOG_SOURCES.LLM, LOG_MESSAGES.PRICE_NORMALIZED, {
                from: args.raw,
                to: normalizedPrice,
                toolCallId: toolCall.id
              });

              // Add tool result to messages for next iteration
              messages.push({
                role: "tool",
                content: JSON.stringify({ normalized: normalizedPrice }),
                tool_call_id: toolCall.id
              });
            }
          }
          maxIterations--;
          continue; // Continue loop to get final response from LLM
        }

        // LLM returned final response (no tool calls)
        if (message.content) {
          try {
            finalResponse = JSON.parse(message.content);
            break; // Exit loop, we have the final response
          } catch (error) {
            logger.error(LOG_SOURCES.LLM, LOG_MESSAGES.JSON_PARSE_FAILED, { url: content.url });
            throw new LLMErrors.InvalidJsonError({ url: content.url });
          }
        } else {
          logger.error(LOG_SOURCES.LLM, LOG_MESSAGES.INVALID_JSON_RETURNED, { url: content.url });
          throw new LLMErrors.InvalidJsonError({ url: content.url });
        }
      }

      if (!finalResponse) {
        throw new LLMErrors.ExtractionFailedError({ url: content.url, reason: "Max iterations reached" });
      }

      this.validateRawMenuResponse(finalResponse, content.url);

      logger.info(LOG_SOURCES.LLM, LOG_MESSAGES.EXTRACTION_SUCCESSFUL, { url: content.url, count: finalResponse.items.length });

      return finalResponse as RawMenuResponse;

    } catch (error) {
      if (error instanceof LLMErrors.InvalidJsonError || error instanceof MenuSchemaErrors.InvalidSchemaError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new LLMErrors.ExtractionFailedError({ originalError: error.message, url: content.url });
      }
      throw new LLMErrors.ExtractionFailedError({ url: content.url });
    }
  }

  /**
   * Step 2 of 2-step extraction pipeline: Normalize raw prices to numbers
   * Fallback normalization for prices that weren't normalized via tool calling
   * LLM may have already normalized some prices via normalizePrice tool, but we ensure all are normalized
   */
  private async normalizePrices(rawMenu: RawMenuResponse, url: string): Promise<MenuResponse> {
    const normalizedItems: MenuItem[] = [];

    for (const item of rawMenu.items) {
      // If price is already a number (normalized by tool calling), use it directly
      // Otherwise, normalize it as fallback
      let normalizedPrice: number;
      if (typeof item.price === "number") {
        normalizedPrice = item.price;
      } else {
        normalizedPrice = this.normalizePrice(item.price);
        
        // Log fallback normalization for debugging
        if (item.price !== undefined && item.price !== null) {
          logger.debug(LOG_SOURCES.LLM, LOG_MESSAGES.PRICE_NORMALIZED, { 
            from: item.price, 
            to: normalizedPrice,
            method: "fallback"
          });
        }
      }

      normalizedItems.push({
        name: item.name,
        price: normalizedPrice,
        allergens: item.allergens,
        weight: item.weight,
        category: item.category
      });
    }

    logger.debug(LOG_SOURCES.LLM, LOG_MESSAGES.PARSED_ITEMS, { url, count: normalizedItems.length });

    return {
      items: normalizedItems
    };
  }

  /**
   * Extracts restaurant name from hostname as fallback
   * Example: "www.restaurace.cz" → "restaurace"
   */
  private getHostnameFallback(url: string): string {
    try {
      const host = new URL(url).hostname;
      return host.replace("www.", "").split(".")[0];
    } catch {
      return "unknown";
    }
  }

  /**
   * Validates extracted restaurant name
   * Rejects generic/invalid names like "unknown" or empty strings
   */
  private isValidRestaurantName(name: string | null | undefined): boolean {
    return !!(
      name && 
      name.toLowerCase() !== "unknown" && 
      name.length > 0 && 
      name.length < 100
    );
  }

  /**
   * Extracts real restaurant name using LLM
   * Falls back to hostname if LLM returns invalid name or fails
   * Examples: "Tlustá Kachna", "U Fleků", "Restaurace Na Rohu"
   */
  async extractRestaurantName(content: { text: string; html: string; url: string }): Promise<string> {
    try {
      logger.info(LOG_SOURCES.LLM, LOG_MESSAGES.EXTRACTING_RESTAURANT_NAME, { url: content.url });
      
      const client = this.getOpenAIClient();
      
      // Truncate content to stay within token limits
      const truncatedText = content.text.substring(0, LLM_CONTENT_LIMITS.MAX_NAME_TEXT_LENGTH);
      const truncatedHtml = content.html.substring(0, LLM_CONTENT_LIMITS.MAX_NAME_HTML_LENGTH);
      
      const response = await client.chat.completions.create({
        model: LLM_CONFIG.NAME_EXTRACTION_MODEL,
        messages: [
          {
            role: "system",
            content: RESTAURANT_NAME_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildRestaurantNameUserPrompt(content.url, truncatedText, truncatedHtml)
          }
        ],
        temperature: LLM_CONFIG.TEMPERATURE,
        max_completion_tokens: LLM_CONFIG.MAX_NAME_TOKENS
      });
      
      const extractedName = response.choices[0].message.content?.trim();
      
      // Use extracted name if valid
      if (this.isValidRestaurantName(extractedName)) {
        logger.info(LOG_SOURCES.LLM, LOG_MESSAGES.RESTAURANT_NAME_EXTRACTED, { name: extractedName, url: content.url });
        return extractedName!;
      }
      
      // Fallback to hostname if LLM returned invalid name
      const fallback = this.getHostnameFallback(content.url);
      logger.warn(LOG_SOURCES.LLM, LOG_MESSAGES.RESTAURANT_NAME_FALLBACK, { name: fallback, url: content.url });
      return fallback;
      
    } catch (error) {
      // Fallback to hostname if LLM call failed
      logger.error(LOG_SOURCES.LLM, LOG_MESSAGES.RESTAURANT_NAME_EXTRACTION_FAILED, { url: content.url });
      return this.getHostnameFallback(content.url);
    }
  }

  /**
   * Main extraction function: orchestrates 2-step pipeline
   * Step 1: Extract raw menu WITH tool calling (normalizePrice tool)
   * Step 2: Fallback normalization for any prices not normalized by tool calling
   */
  async extractMenu(content: { html: string; text: string; url: string; day: string }): Promise<MenuResponse> {
    const rawMenu = await this.extractMenuRaw(content);
    return await this.normalizePrices(rawMenu, content.url);
  }
}

export const llmService = new LLMService();
