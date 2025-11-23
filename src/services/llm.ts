import OpenAI from "openai";
import { logger } from "../utils/logger";
import { LLMErrors, MenuSchemaErrors } from "../errors";

export type MenuItem = {
  name: string;
  price?: number;
  description?: string;
  allergens?: string[];
  weight?: string;
};

export type MenuResponse = {
  items: MenuItem[];
};

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new LLMErrors.ApiKeyMissingError();
  }
  
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function normalizePrice(raw: string): { price: number } {
  const cleaned = raw.replace(/[^\d,.]/g, "");
  
  const normalized = cleaned.replace(",", ".");
  
  const price = parseFloat(normalized);
  
  if (isNaN(price)) {
    return { price: 0 };
  }
  
  return { price };
}

function validateMenuResponse(parsed: any, url: string): void {
  if (!parsed.items || !Array.isArray(parsed.items)) {
    logger.error("LLM", "Schema validation failed", { reason: "Missing or invalid items array" });
    throw new MenuSchemaErrors.InvalidSchemaError({ reason: "Missing or invalid items array", url });
  }
  
  for (const item of parsed.items) {
    if (!item.name || typeof item.name !== "string" || item.name.trim().length === 0) {
      logger.error("LLM", "Schema validation failed", { reason: "Invalid item name" });
      throw new MenuSchemaErrors.InvalidSchemaError({ reason: "Invalid item name", url });
    }
  }
}

function normalizeAllPrices(items: MenuItem[]): MenuItem[] {
  return items.map(item => {
    if (item.price !== undefined && typeof (item.price as any) === "string") {
      const normalized = normalizePrice(item.price as any);
      logger.debug("LLM", "Price normalized", { from: item.price, to: normalized.price });
      return { ...item, price: normalized.price };
    }
    return item;
  });
}

export async function extractMenu(content: { html: string; text: string; url: string }): Promise<MenuResponse> {
  const client = getOpenAIClient();

  logger.info("LLM", "Extraction started", { url: content.url });

  const systemMessage = "You extract restaurant menu items from raw HTML and extracted text. Return structured JSON only.";
  
  // TODO: Add retry logic with exponential backoff for rate limits
  // TODO: Add token counting and cost tracking
  // TODO: Implement streaming for large responses
  
  const userMessage = `
Extract menu items from the following restaurant page:

URL: ${content.url}

Extracted Text:
${content.text}

Raw HTML (for reference):
${content.html.substring(0, 5000)}...
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "normalizePrice",
            description: "Normalize price strings like '145,-' into numbers",
            parameters: {
              type: "object",
              properties: {
                raw: { type: "string" }
              },
              required: ["raw"]
            }
          }
        }
      ]
    });

    const message = response.choices[0].message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.type === "function" && toolCall.function.name === "normalizePrice") {
        const args = JSON.parse(toolCall.function.arguments);
        const normalized = normalizePrice(args.raw);
        return { items: [] };
      }
    }

    if (!message.content) {
      logger.error("LLM", "Invalid JSON returned", { url: content.url });
      throw new LLMErrors.InvalidJsonError({ url: content.url });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(message.content);
    } catch (error) {
      logger.error("LLM", "JSON parse failed", { url: content.url });
      throw new LLMErrors.InvalidJsonError({ url: content.url });
    }

    validateMenuResponse(parsed, content.url);

    const normalizedItems = normalizeAllPrices(parsed.items);

    logger.info("LLM", "Extraction successful", { url: content.url, count: normalizedItems.length });
    logger.debug("LLM", "Parsed items", { url: content.url, count: normalizedItems.length });

    return {
      items: normalizedItems
    };

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
