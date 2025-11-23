import OpenAI from "openai";

/**
 * Type definition for a single menu item
 */
export type MenuItem = {
  name: string;
  price?: number;
  description?: string;
  allergens?: string[];
  weight?: string;
};

/**
 * Type definition for the complete menu response
 */
export type MenuResponse = {
  items: MenuItem[];
};

/**
 * Initialize OpenAI client with API key from environment
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Set it in .env");
  }
  
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Extracts restaurant menu items from HTML and text content using LLM.
 * 
 * @param content - Object containing html, text, and url of the restaurant page
 * @returns Raw LLM response (to be parsed later)
 */
export async function extractMenu(content: { html: string; text: string; url: string }): Promise<any> {
  const client = getOpenAIClient();

  // Prepare messages for the LLM
  const systemMessage = "You extract restaurant menu items from raw HTML and extracted text. Return structured JSON only.";
  
  const userMessage = `
Extract menu items from the following restaurant page:

URL: ${content.url}

Extracted Text:
${content.text}

Raw HTML (for reference):
${content.html.substring(0, 5000)}...
`.trim();

  // TODO: Validate structured output against MenuResponse schema
  // TODO: Process function call results if the model requests normalizePrice
  // TODO: Add retry logic with exponential backoff for rate limits
  // TODO: Fallback to HTML-only extraction if text is insufficient
  // TODO: Add token counting and cost tracking
  // TODO: Implement streaming for large responses

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
      functions: [
        {
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
      ]
    });

    // Return raw response for now (no parsing/validation yet)
    return response;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`LLM extraction failed: ${error.message}`);
    }
    throw new Error("LLM extraction failed: Unknown error");
  }
}

/**
 * Dummy function to normalize price strings (to be implemented later)
 * This will be called when the LLM requests price normalization
 * 
 * @param raw - Raw price string like "145,-" or "$12.99"
 * @returns Normalized price as a number
 */
export function normalizePrice(raw: string): { price: number } {
  // TODO: Implement actual price normalization logic
  // Handle formats like: "145,-", "$12.99", "12,50 €", etc.
  return { price: 0 };
}
