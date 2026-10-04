/* ═══════════════════════════════════════════════════════════════════
   XMARKET — API LAYER (currently mocked)
   ═══════════════════════════════════════════════════════════════════

   ENVIRONMENT VARIABLES
   process.env.NEXT_PUBLIC_API_URL  → Your backend base URL
   process.env.GEMINI_API_KEY       → Google AI Studio key
   process.env.GROQ_API_KEY         → Groq console key
   process.env.NEXTAUTH_SECRET      → NextAuth secret
   process.env.GOOGLE_CLIENT_ID     → Google OAuth client ID
   process.env.GOOGLE_CLIENT_SECRET → Google OAuth secret

   REAL ENDPOINT MAP — swap each mock below for the corresponding call:

   AUTH
   POST /api/auth/login              → { email, password } → JWT
   GET  /api/auth/google             → OAuth2 redirect
   GET  /api/auth/google/callback    → OAuth complete → JWT
   GET  /api/auth/me                 → { user }

   REQUIREMENTS (Buyer)
   POST   /api/requirements          → { rawText, structured }
   GET    /api/requirements          → [list]
   GET    /api/requirements/:id      → single
   DELETE /api/requirements/:id

   AI (LLM-powered — plug in Gemini or Groq)
   POST /api/ai/extract   → { rawText } → { category, budget,
                            deadline, preferences, confidence }
   POST /api/ai/explain   → { offerId, reqId } → { explanation }
   POST /api/ai/clarify   → { reqId } → { questions[] }
   GET  /api/ai/relax     → { reqId } → { relaxedConstraints }

   PRODUCT SUGGESTIONS
   GET /api/products/suggest?q=    → { suggestions[] }
   (Debounce frontend calls by 250ms)

   OFFERS (Provider)
   POST   /api/offers               → { requirementId, price,
                                        deliveryDays, notes }
   GET    /api/offers/:reqId        → [ranked offers with scores]
   PATCH  /api/offers/:id/select    → buyer selects
   PATCH  /api/offers/:id/shortlist → buyer shortlists

   MATCHES
   GET /api/matches/:reqId          → ranked offers with AI scores
   Scoring: hard constraints + semantic relevance +
            price fit + deadline fit + trust score
   ═══════════════════════════════════════════════════════════════════ */

import { PRODUCTS, MATCHES, REQUIREMENTS, MY_OFFERS } from "./mockData";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// POST /api/auth/login
export async function loginUser({ email, password }) {
  await delay(900);
  // TODO: replace with → fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) })
  // TODO: on success → store JWT (httpOnly cookie preferred) → redirect /dashboard
  return { ok: true, token: "mock-jwt", user: { email } };
}

// GET /api/products/suggest?q=   (frontend debounce: 250ms)
export async function fetchSuggestions(q) {
  await delay(120);
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  return PRODUCTS.filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(query)
  );
}

// POST /api/ai/extract  — debounced 800ms after the user stops typing.
// Response: { category, budget, deadline, preferences, confidence }
export async function extractRequirement(rawText) {
  await delay(600);
  const text = rawText.trim();
  const product = PRODUCTS.find((p) =>
    text.toLowerCase().includes(p.name.split(" (")[0].split(",")[0].toLowerCase().slice(0, 8))
  );
  const priceMatch = text.match(/\$?\s?(\d{2,5})/);
  const dayMatch = text.match(/(\d+)\s*(day|days|week|weeks)/i);
  const budget = priceMatch ? `Up to $${priceMatch[1]}` : "Not specified";
  const deadline = dayMatch ? `Within ${dayMatch[1]} ${dayMatch[2].toLowerCase()}` : "Flexible";
  const confidence = Math.min(96, 74 + Math.floor(text.length / 6));
  return {
    category: product ? product.category : text.length > 12 ? "General Goods" : "—",
    budget,
    deadline,
    preferences: text.length > 0 ? text.split(/\s+/).slice(0, 3).join(" ") : "—",
    confidence,
  };
}

// POST /api/requirements — persists { rawText, structured }
export async function postRequirement({ rawText, structured }) {
  await delay(1000);
  return { ok: true, id: "req_mock_001" };
}

// GET /api/matches/:reqId — ranked offers with AI scores
export async function fetchMatches(reqId = "req_mock_001") {
  await delay(900);
  return [...MATCHES].sort((a, b) => b.score - a.score);
}

// POST /api/ai/explain { offerId, requirementId } → { explanation }
export async function explainMatch(offerId, reqId) {
  await delay(200);
  const offer = MATCHES.find((o) => o.id === offerId);
  return { explanation: offer ? offer.why : "" };
}

// GET /api/requirements — public provider feed
export async function fetchRequirements() {
  await delay(700);
  return REQUIREMENTS;
}

// GET /api/offers — my offers as provider
export async function fetchMyOffers() {
  await delay(500);
  return MY_OFFERS;
}

// POST /api/offers { requirementId, price, deliveryDays, notes }
export async function submitOffer({ requirementId, price, delivery, notes }) {
  await delay(800);
  return { ok: true, id: `off_${Date.now()}` };
}

// PATCH /api/offers/:id/shortlist
export async function toggleShortlist(offerId, shortlisted) {
  return { ok: true };
}

// PATCH /api/offers/:id/select
export async function selectOffer(offerId) {
  await delay(300);
  return { ok: true };
}
