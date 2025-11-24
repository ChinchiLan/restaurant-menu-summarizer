export const LOG_SOURCES = {
  SUMMARIZE: "SUMMARIZE",
  SCRAPER: "SCRAPER",
  LLM: "LLM",
  CACHE: "CACHE",
  SERVER: "SERVER",
  AUTH: "AUTH"
} as const;

export const LOG_MESSAGES = {
  // Cache messages
  CACHE_HIT: "Cache hit",
  CACHE_MISS: "Cache miss",
  CACHE_INITIALIZED: "Cache initialized",
  CACHE_DATABASE_INITIALIZED: "Cache database initialized",
  CACHE_DATABASE_CLOSED: "Cache database closed",
  SAVED_TO_CACHE: "Saved to cache",
  INVALIDATED_OLD_RECORDS: "Invalidated old records",
  
  // Scraper messages
  FETCH_STARTED: "Fetch started",
  FETCH_SUCCESSFUL: "Fetch successful",
  FETCH_FAILED: "Fetch failed",
  EMPTY_HTML_RESPONSE: "Empty HTML response",
  UNEXPECTED_ERROR: "Unexpected error",
  
  // LLM messages
  EXTRACTION_STARTED: "Extraction started",
  EXTRACTION_SUCCESSFUL: "Extraction successful",
  EXTRACTING_RESTAURANT_NAME: "Extracting restaurant name via LLM",
  RESTAURANT_NAME_EXTRACTED: "Restaurant name extracted via LLM",
  RESTAURANT_NAME_FALLBACK: "Using hostname as fallback for restaurant name",
  RESTAURANT_NAME_EXTRACTION_FAILED: "Failed to extract restaurant name",
  DAY_PASSED_TO_LLM: "Day passed to LLM",
  PRICE_NORMALIZED: "Price normalized",
  PARSED_ITEMS: "Parsed items",
  INVALID_JSON_RETURNED: "Invalid JSON returned",
  JSON_PARSE_FAILED: "JSON parse failed",
  SCHEMA_VALIDATION_FAILED: "Schema validation failed",
  
  // Summarize messages
  SCRAPER_STARTED: "Scraper started",
  LLM_EXTRACTION_STARTED: "LLM extraction started",
  LLM_EXTRACTION_FAILED: "LLM extraction failed",
  NO_DAILY_MENU_FOUND: "No daily menu found on page (only regular menu)",
  REQUEST_SUCCESSFUL: "Request successful",
  DAY_EXTRACTED: "Day extracted from date",
  
  // Server messages
  SERVER_LISTENING: "Server listening",
  GRACEFUL_SHUTDOWN: "Graceful shutdown initiated",
  FAILED_TO_START_SERVER: "Failed to start server",
  
  // Auth messages
  API_KEY_MISSING: "API key missing",
  API_KEY_INVALID: "Invalid API key",
  API_KEY_VALID: "API key valid",
  API_KEY_NOT_CONFIGURED: "API_KEY not configured in environment",
  
  // Error mapper messages
  UNKNOWN_ERROR: "Unknown error"
} as const;
