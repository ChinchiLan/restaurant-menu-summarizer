import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Scrapes a URL and returns raw HTML and extracted plain text.
 * 
 * @param url - The URL to scrape
 * @returns Object containing raw HTML and extracted text
 * @throws Error if the fetch fails or HTML is empty
 */
export async function scrape(url: string): Promise<{ html: string; text: string }> {
  try {
    // Fetch the HTML content from the URL
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;

    // Check if HTML is empty
    if (!html || html.trim().length === 0) {
      throw new Error("Empty HTML response");
    }

    // Load HTML into Cheerio
    const $ = cheerio.load(html);

    // Remove script and style elements to get cleaner text
    $('script').remove();
    $('style').remove();

    // Extract visible text content
    const text = $('body').text()
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .trim();

    // TODO: Add fallback LLM fetch if text extraction is insufficient
    // TODO: Add support for JavaScript-rendered content (Puppeteer/Playwright)
    // TODO: Add retry logic with exponential backoff

    return {
      html,
      text
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error("Failed to fetch URL: " + url);
    }
    
    // Re-throw if it's already our custom error
    if (error instanceof Error && error.message === "Empty HTML response") {
      throw error;
    }

    // Handle any other unexpected errors
    throw new Error("Failed to fetch URL: " + url);
  }
}
