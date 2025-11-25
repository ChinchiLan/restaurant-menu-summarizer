# Restaurant Menu Summarizer

Node.js backend API for extracting and summarizing restaurant menus using LLM.

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in the following variables:

```env
# OpenAI API key for menu extraction
OPENAI_API_KEY=your_openai_api_key_here

# API Key for endpoint authentication
API_KEY=your_secret_api_key_here

# Logging level
LOG_LEVEL=info
```

**Generate API key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run the application

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**Docker:**
```bash
docker compose up --build
```

### 4. Run tests

```bash
npm test
```

---

## 📡 API Endpoints

### POST `/api/summarize`

Extracts menu from restaurant URL for the specified date.

**Authentication:** Requires API key in `x-api-key` header or `Authorization: Bearer <key>`

**Request:**
```json
{
  "url": "https://restaurace.cz",
  "date": "2025-11-24",
  "preferences": {
    "price": 150,
    "allergens": [7, 3]
  }
}
```

**Response:**
```json
{
  "restaurant_name": "Restaurace XYZ",
  "date": "2025-11-24",
  "day_of_week": "Neděle",
  "menu_items": [
    {
      "name": "Hovězí vývar",
      "price": 45,
      "allergens": ["1", "3"],
      "weight": "350ml",
      "category": "polévka"
    }
  ],
  "daily_menu": true,
  "recommendedMeal": "Hovězí vývar"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://restaurace.cz",
    "date": "2025-11-24"
  }'
```

---

## 🛠️ Technologies

- **Node.js** + **TypeScript**
- **Express** - REST API framework
- **OpenAI API** - LLM for menu extraction
- **Cheerio** - HTML parsing
- **SQLite** - Persistent caching
- **Zod** - Input validation
- **Jest** - Testing framework

---

## 📂 Project Structure

```
src/
├── controllers/        # Request handlers
├── services/           # Business logic
│   ├── menu.service.ts
│   ├── llm.service.ts
│   ├── scraper.service.ts
│   └── cache.service.ts
├── middleware/         # Express middleware
│   └── auth.middleware.ts
├── validators/         # Zod schemas
├── errors/             # Custom error classes
├── utils/              # Helpers
├── constants/          # Constants & config
├── types/              # TypeScript types
└── prompts/            # LLM prompts

tests/
├── unit/               # Unit tests
└── integration/        # Integration tests
```

---

## 🔐 Security

- API key authentication required
- Input validation with Zod schemas
- URL sanitization (only HTTP/HTTPS)
- Error handling with custom error codes
- Structured logging

---

## 📝 Features

✅ Web scraping (Cheerio)  
✅ LLM-based menu extraction (OpenAI)  
✅ Structured JSON output  
✅ Function calling for price normalization  
✅ SQLite caching with TTL  
✅ Czech weekday detection  
✅ Category inference  
✅ Preferences filtering (price, allergens)  
✅ API key authentication  
✅ Comprehensive error handling  
✅ Unit + integration tests  
✅ Docker support  

---

## 🌐 Web Content Retrieval Method

**Selected variant: Variant A - Custom Scraper (Cheerio)**

The assignment offered two approaches:
- **Variant A:** Custom scraper (Cheerio, Puppeteer, Playwright, BeautifulSoup)
- **Variant B:** LLM built-in search/web fetch (Claude web search, Perplexity API)

I chose **Variant A (custom scraper)** over LLM web fetch because:

- **Reliability:** LLM web fetch APIs are inconsistent – sometimes return empty results, irrelevant content, or fail to find the correct page. Custom scraper provides predictable, repeatable results.
- **Cost efficiency:** LLM web fetch requires two LLM calls (fetch + extract), while custom scraper uses free HTTP requests and only one LLM call for extraction.
- **Control:** Direct access to raw HTML ensures we get exactly what's on the page, with full control over error handling and content extraction.
- **Dependencies:** Custom scraper has no external API dependencies or rate limits beyond the restaurant website itself.

**Why Cheerio specifically?**

Since the project is built in Node.js, BeautifulSoup (Python) was excluded. Between Cheerio, Puppeteer, and Playwright, I chose Cheerio because:

- Puppeteer/Playwright are headless browsers – overkill for simple HTML downloading
- We only need static HTML parsing, not JavaScript rendering or anti-bot protection
- Cheerio is lightweight, fast, and sufficient for extracting text content from static pages
- Reduces Docker image size and performance overhead compared to full browser instances

---

## 💭 Project Considerations

I focused on creating a clean, maintainable architecture with clear separation of concerns. Services are implemented as class-based modules with single exported instances, making the codebase testable and easy to understand. I prioritized code readability through consistent naming conventions, extracted constants for magic numbers, and added comments where logic is complex. The two-step LLM extraction pipeline (raw extraction → price normalization) provides better control and error handling, while the tool calling implementation demonstrates understanding of OpenAI's function calling capabilities, even though post-processing would be simpler. Input validation using Zod as a single source of truth ensures type safety at runtime, and structured error handling with custom error classes provides clear, actionable feedback. The pre-check mechanism for daily menu indicators is a practical cost optimization that prevents expensive LLM calls on à la carte menu pages, showing real-world thinking about API costs and efficiency.

Beyond core functionality, I added features that provide real user value: preferences filtering by price and allergens allows users to find meals that match their dietary needs and budget constraints, and the recommended meal feature suggests the first matching item. The caching strategy using SQLite with URL+date keys ensures repeated requests don't trigger unnecessary LLM calls, while the date-based TTL mechanism (invalidates at midnight local time) keeps the cache fresh and ensures menus from previous days are never reused. Cache entries are valid only for the specific calendar date they were created for, with automatic cleanup of expired entries on startup and at midnight. Several edge cases are handled gracefully: empty menus return `daily_menu: false` rather than errors, invalid URLs are caught early with Zod validation, and LLM failures propagate proper error codes with retry logic and exponential backoff. However, some scenarios could be improved: handling image-only menus would require OCR integration, holiday detection could prevent requests to closed restaurants, and real-time menu updates during the day aren't currently supported (cache is date-based, not time-based). For production use, I would consider adding rate limiting, request queuing for high-traffic scenarios, webhook notifications for menu changes, and potentially a more sophisticated caching strategy with Redis for distributed deployments. The current implementation prioritizes simplicity, correctness, and maintainability over advanced features, which aligns well with the assignment scope.

---

## 🧪 Test URLs

For testing purposes, you can use these restaurant URLs:

- **https://www.ukaplickychrudim.cz/menu/tydenni-menu/** - Weekly menu with daily items
- **https://www.nejendvorek.cz/jidelni-listek** - Daily menu with structured format
- **https://www.tlustakachna.cz/jidelni-listek/** - À la carte menu only (no daily menu) - used to test the pre-check functionality that skips LLM calls for non-daily menu pages

---

## 📊 Testing

```bash
# All tests
npm test

# Specific test suite
npm test -- tests/unit/llm.test.ts

# Coverage
npm test -- --coverage
```

**Test suites:** 7  
**Tests:** 82  
**Coverage:** Unit + Integration (~90%+)

---

## 🚨 Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `restaurantMenuSummarizer/validation/urlEmpty` | 400 | Missing URL |
| `restaurantMenuSummarizer/validation/invalidUrlFormat` | 400 | Invalid URL format |
| `restaurantMenuSummarizer/validation/dateEmpty` | 400 | Missing date |
| `restaurantMenuSummarizer/validation/invalidDateFormat` | 400 | Invalid date format |
| `restaurantMenuSummarizer/auth/apiKeyMissing` | 401 | Missing API key |
| `restaurantMenuSummarizer/auth/unauthorized` | 401 | Invalid API key |
| `restaurantMenuSummarizer/scraper/fetchFailed` | 502 | Failed to fetch URL |
| `restaurantMenuSummarizer/scraper/htmlEmpty` | 502 | Empty HTML response |
| `restaurantMenuSummarizer/llm/invalidJson` | 500 | Invalid JSON from LLM |
| `restaurantMenuSummarizer/llm/extractionFailed` | 500 | LLM extraction failed |
| `restaurantMenuSummarizer/menuSchema/invalidSchema` | 500 | Invalid menu schema |

---

## 📄 License

MIT
