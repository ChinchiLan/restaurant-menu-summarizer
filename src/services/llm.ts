import OpenAI from "openai";

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
    throw new Error("Missing OPENAI_API_KEY. Set it in .env");
  }
  
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function normalizePrice(raw: string): { price: number } {
  const cleaned = raw.replace(/[^\d,\.]/g, "");
  
  const normalized = cleaned.replace(",", ".");
  
  const price = parseFloat(normalized);
  
  if (isNaN(price)) {
    return { price: 0 };
  }
  
  return { price };
}

function validateMenuResponse(parsed: any): void {
  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error("LLM output did not match MenuResponse schema");
  }
  
  for (const item of parsed.items) {
    if (!item.name || typeof item.name !== "string" || item.name.trim().length === 0) {
      throw new Error("LLM output did not match MenuResponse schema");
    }
  }
}

function normalizeAllPrices(items: MenuItem[]): MenuItem[] {
  return items.map(item => {
    if (item.price !== undefined && typeof item.price === "string") {
      const normalized = normalizePrice(item.price as any);
      return { ...item, price: normalized.price };
    }
    return item;
  });
}

export async function extractMenu(content: { html: string; text: string; url: string }): Promise<MenuResponse> {
  const client = getOpenAIClient();

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

    const message = response.choices[0].message;

    if (message.function_call) {
      if (message.function_call.name === "normalizePrice") {
        const args = JSON.parse(message.function_call.arguments);
        const normalized = normalizePrice(args.raw);
        return { items: [] };
      }
    }

    if (!message.content) {
      throw new Error("Invalid JSON returned from LLM");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(message.content);
    } catch (error) {
      throw new Error("Invalid JSON returned from LLM");
    }

    validateMenuResponse(parsed);

    const normalizedItems = normalizeAllPrices(parsed.items);

    return {
      items: normalizedItems
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`LLM extraction failed: ${error.message}`);
    }
    throw new Error("LLM extraction failed: Unknown error");
  }
}
