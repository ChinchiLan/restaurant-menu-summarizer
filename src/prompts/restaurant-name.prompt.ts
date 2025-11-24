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
Input:
<title>Restaurace U Lípy | Denní menu</title>
→ Output:
Restaurace U Lípy

Input:
<h1>U Tří Zlatých Hrušek</h1>
→ Output:
U Tří Zlatých Hrušek

Input:
<title>Menu | Hospoda U Kačera</title>
→ Output:
Hospoda U Kačera

======================
BAD EXAMPLES (NEVER RETURN)
======================
"Menu"
"Denní nabídka"
"Jídelní lístek"
"restaurace-example.cz"
"homepage"
"unknown restaurant" (must be literally "unknown")

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

Relevant text:
${text}

Relevant HTML (title + headers preferred):
${html}

Return ONLY the name, nothing else.`;
}
