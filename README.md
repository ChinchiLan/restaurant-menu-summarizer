# Restaurant Menu Summarizer

Node.js backend API pro extrakci a sumarizaci jídelních lístků pomocí LLM.

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Vytvoř soubor `.env` podle `.env.example`:

```bash
cp .env.example .env
```

Vyplň následující proměnné:

```env
# OpenAI API key pro extrakci menu
OPENAI_API_KEY=your_openai_api_key_here

# API Key pro autentizaci endpointu
API_KEY=your_secret_api_key_here

# Logging level
LOG_LEVEL=info
```

**Vygenerovat API klíč:**
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

### 4. Run tests

```bash
npm test
```

---

## 📡 API Endpoints

### POST `/api/summarize`

Extrahuje menu z URL restaurace pro zadané datum.

**Authentication:** Vyžaduje API key v headeru `x-api-key` nebo `Authorization: Bearer <key>`

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
  "extraction_status": "success",
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
- **OpenAI API** - LLM pro extrakci menu
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

**Test suites:** 6  
**Tests:** 55  
**Coverage:** Unit + Integration

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

