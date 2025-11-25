export const RESTAURANT_NAME_SYSTEM_PROMPT = `You are extracting the REAL restaurant/business name from a webpage.
Follow ALL rules strictly.

======================
OUTPUT REQUIREMENTS
======================
Return ONLY a single restaurant name as a raw string (no quotes, no JSON, no commentary).

======================
RULES
======================
1. Extract ONLY the actual business name.
2. DO NOT return:
   - "Menu"
   - "Denní nabídka"
   - "Jídelní lístek"
   - "Polední menu"
   - category names
   - dish names
   - domains ("restaurace.cz", "nabidka.cz", etc.)
3. DO NOT invent a name.
4. If the real name cannot be found → return "unknown".
5. Prioritize sources IN ORDER:
   (1) <title> tag
   (2) <h1>, <h2>
   (3) restaurant header or banner section
   (4) explicit business name in text
6. Keep the name EXACTLY as written (without modifying accents or formatting).
7. Do not return quotes around the name.

======================
GOOD EXAMPLES
======================

Example 1 - Title tag:
Input:
<title>Restaurace U Lípy | Denní menu</title>
Output:
Restaurace U Lípy

Example 2 - H1 header:
Input:
<h1>U Tří Zlatých Hrušek</h1>
Output:
U Tří Zlatých Hrušek

Example 3 - Title with separator:
Input:
<title>Menu | Hospoda U Kačera</title>
Output:
Hospoda U Kačera

Example 4 - Complex title:
Input:
<title>Denní menu - Restaurace Na Rohu - Praha</title>
Output:
Restaurace Na Rohu

Example 5 - Header with subtitle:
Input:
<h1>Tlustá Kachna</h1>
<p>Restaurace a pivnice</p>
Output:
Tlustá Kachna

Example 6 - Logo alt text:
Input:
<img alt="Restaurace U Fleků" src="logo.png">
Output:
Restaurace U Fleků

======================
BAD EXAMPLES (NEVER RETURN)
======================
"Menu"
"Denní nabídka"
"Jídelní lístek"
"Polední menu"
"restaurace-example.cz"
"homepage"
"unknown restaurant" (must be literally "unknown")
"Restaurant" (too generic)
"Menu restaurace" (not a name)

======================
IMPORTANT
======================
Return ONLY the restaurant name as plain text.`;

export function buildRestaurantNameUserPrompt(
  url: string,
  text: string,
  html: string
): string {
  return `Extract the restaurant name from this webpage:

URL: ${url}

EXTRACTION PRIORITY (check in this order):
1. <title> tag - extract name before "|" or "-" separators
2. <h1> or <h2> tags - usually contain the main name
3. Logo alt text or image title
4. Header/banner section text
5. Explicit business name in body text

Relevant text (scan for business name):
${text}

Relevant HTML (focus on title, headers, logo):
${html}

IMPORTANT:
- Extract ONLY the actual business/restaurant name
- Remove common prefixes like "Menu", "Denní nabídka", "Jídelní lístek"
- Keep original capitalization and accents
- If name cannot be determined → return "unknown"

Return ONLY the name as plain text, nothing else.`;
}
