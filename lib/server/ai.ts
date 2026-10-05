import type { Bid, Provider, Requirement, Weights } from "@/lib/types";
import { CATEGORIES } from "@/lib/data";
import {
  chat,
  config,
  status as llmStatus,
  systemPrompt,
  untrusted,
  type ChatResult,
} from "./llm";
import { recordEvent, rank } from "./repo";
import {
  comparisonSummarySchema,
  draftBidSchema,
  parsedRequirementSchema,
  semanticScoreSchema,
  type ComparisonSummary,
  type DraftBid,
  type ParsedRequirement,
  type SemanticScore,
} from "./schema";

/* ==========================================================================
   AI capabilities
   Each capability is one prompt plus one deterministic fallback. The fallback
   is not a placeholder: when no API key is present the product still produces
   something useful, and every response says which one answered.
   ========================================================================== */

export interface AiMeta {
  provider: string;
  model: string;
  mode: "llm" | "heuristic";
  cached: boolean;
  latencyMs: number;
  note?: string;
}

export interface AiResponse<T> {
  data: T;
  meta: AiMeta;
}

function metaFrom<T>(result: ChatResult<T>, extra?: Partial<AiMeta>): AiMeta {
  return {
    provider: result.provider,
    model: result.model,
    mode: result.provider === "offline" ? "heuristic" : "llm",
    cached: result.cached,
    latencyMs: result.latencyMs,
    ...extra,
  };
}

function heuristicMeta(started: number, note: string): AiMeta {
  const c = config();
  return {
    provider: "offline",
    model: "xmarket-heuristic-v1",
    mode: "heuristic",
    cached: false,
    latencyMs: Date.now() - started,
    note,
  };
}

/**
 * Tries the model, then the fallback. Only schema/network failures fall back;
 * an explicit rate limit is surfaced so a caller can choose to wait.
 */
async function withFallback<T>(
  live: () => Promise<AiResponse<T>>,
  offline: () => AiResponse<T> | Promise<AiResponse<T>>,
  capability: string
): Promise<AiResponse<T>> {
  if (!llmStatus().live) {
    const response = await offline();
    await recordEvent({
      type: "ai.invoked",
      actor: "system",
      summary: `${capability} answered by the offline heuristic engine`,
      meta: { mode: "heuristic" },
    });
    return response;
  }
  try {
    const response = await live();
    await recordEvent({
      type: "ai.invoked",
      actor: "system",
      summary: `${capability} answered by ${response.meta.provider} (${response.meta.model})`,
      meta: { mode: "llm", cached: response.meta.cached, latencyMs: response.meta.latencyMs },
    });
    return response;
  } catch (error) {
    console.warn(
      `[ai] ${capability} fell back to heuristics:`,
      error instanceof Error ? error.message : error
    );
    const response = await offline();
    return {
      ...response,
      meta: {
        ...response.meta,
        note: `Model call failed, heuristic answer shown. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      },
    };
  }
}

/* ======================================================================
   1. Requirement parsing — free text brief into a structured requirement
   ====================================================================== */

export async function parseRequirement(
  brief: string,
  defaults?: { category?: string; location?: string }
): Promise<AiResponse<ParsedRequirement>> {
  const categoryLabels = CATEGORIES.map((c) => `${c.id}: ${c.label} / ${c.blurb}`).join("\n");

  return withFallback<ParsedRequirement>(
    async () => {
      const result = await chat<ParsedRequirement>(
        [
          {
            role: "system",
            content: systemPrompt(
              `Convert a buyer's free-text brief into a structured procurement requirement.\n\nAvailable categories:\n${categoryLabels}\n\nReturn a JSON object with exactly these keys:\n{"title": string (max 140),\n "summary": string (one sentence, max 240),\n "description": string (2-4 paragraphs, keep the buyer's specifics),\n "category": one of the category ids above,\n "budgetMax": integer USD (hard ceiling),\n "budgetTarget": integer USD (what they hope to pay, <= budgetMax),\n "deadlineInDays": integer days until delivery is needed,\n "closingInDays": integer days the bidding window stays open (default 14),\n "location": string,\n "tags": string[] (3-8 short spec keywords used to score providers),\n "mustHaves": string[] (0-6 hard requirements),\n "confidence": number 0-1,\n "assumptions": string[] (anything you had to infer)}\n\nBudget rules:\n- budgetMax and budgetTarget are TOTAL project budgets in USD, never hourly, daily, monthly or per-unit rates.\n- Preserve an explicit total budget or hard ceiling. Never replace it with a rate mentioned elsewhere in the brief.\n- When only a rate is given, multiply it by the stated quantity, hours or duration only when the total scope is clear. Do not treat a delivery deadline as billable hours. Explain the calculation in assumptions.\n- If no total budget can be calculated, infer a defensible range for the full scope of work and clearly list the estimated budget and any inferred quantity or effort as assumptions.\n- Keep budgetTarget <= budgetMax. Do not invent a higher ceiling when the buyer states a hard cap.`
            ),
          },
          { role: "user", content: untrusted("buyer brief", brief) },
        ],
        { schema: parsedRequirementSchema, temperature: 0.2 }
      );
      // A schema-valid reply can still mistake a unit/hourly rate for the whole
      // project budget. Use the same $500 noise floor as extractMoney; the throw
      // drops this answer and the fallback below labels the estimate and asks
      // the buyer to review the numbers.
      const hasRateLanguage =
        /(?:\bper[\s-]+(?:hours?|hrs?|days?|weeks?|months?|units?|items?|pieces?)\b|\/\s*(?:h|hr|hrs|hour|hours|day|week|month|unit|item|piece)\b|\b(?:hourly|daily|weekly|monthly|unit[\s-]+(?:cost|price|rate))\b)/i.test(brief);
      if (
        hasRateLanguage &&
        Math.min(result.value.budgetMax, result.value.budgetTarget) < 500
      ) {
        throw new Error("Model returned a likely rate instead of a total project budget.");
      }
      return { data: result.value, meta: metaFrom(result) };
    },
    () => {
      const started = Date.now();
      return {
        data: heuristicParse(brief, defaults),
        meta: heuristicMeta(started, "Extracted with pattern matching — review the numbers before publishing."),
      };
    },
    "Requirement parsing"
  );
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  manufacturing: ["cnc", "machin", "mould", "mold", "tooling", "sheet metal", "casting", "fabricat", "weld", "aluminium", "aluminum", "injection"],
  software: ["software", "app", "web", "api", "dashboard", "platform", "frontend", "backend", "database", "migration", "saas", "next.js", "react"],
  logistics: ["freight", "haulage", "shipping", "cold chain", "ltl", "pallet", "warehous", "logistics", "customs", "truck", "transport"],
  design: ["design", "brand", "packaging", "identity", "logo", "illustrat", "ux", "ui", "motion", "art direction"],
  construction: ["fit-out", "fitout", "construction", "mep", "cleanroom", "mezzanine", "permit", "hvac", "civil", "electrical install"],
  electronics: ["pcb", "smt", "firmware", "embedded", "circuit", "sensor", "iot", "microcontroller", "stm32", "esp32", "emc"],
};

const TAG_DICTIONARY = [
  "5-axis CNC", "CNC", "Aluminium 6061", "Anodising", "Injection moulding", "Sheet metal",
  "Next.js", "React", "TypeScript", "Postgres", "REST API", "Design system", "Data viz",
  "Accessibility", "ETL", "Data reconciliation", "Legacy migration", "Node.js",
  "Cold chain", "LTL", "Temperature logging", "FDA FSMA", "Dedicated lane", "Last mile",
  "Packaging", "Dielines", "Sustainability", "Retail", "Brand system", "Identity",
  "Fit-out", "MEP", "Permits", "Phased works", "ISO 8 cleanroom",
  "SMT", "0201", "AOI", "Conformal coating", "Traceability", "PCB layout", "Firmware",
  "ISO 9001", "PPAP", "EMC testing", "FCC pre-scan", "Prototyping", "Tooling",
];

export function heuristicParse(
  brief: string,
  defaults?: { category?: string; location?: string }
): ParsedRequirement {
  const lower = brief.toLowerCase();
  const sentences = brief
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // --- money -------------------------------------------------------------
  const money = extractMoney(brief);
  const budgetMax = money.length ? Math.max(...money) : 50_000;
  const budgetTarget = money.length
    ? Math.min(...money)
    : Math.round(budgetMax * 0.82);

  // --- timing ------------------------------------------------------------
  const weeks = /(\d+)\s*(?:\+)?\s*weeks?/.exec(lower);
  const days = /(\d+)\s*days?/.exec(lower);
  const months = /(\d+)\s*months?/.exec(lower);
  let deadlineInDays = 60;
  if (weeks) deadlineInDays = Number(weeks[1]) * 7;
  else if (months) deadlineInDays = Number(months[1]) * 30;
  else if (days) deadlineInDays = Number(days[1]);
  else if (/urgent|asap|immediately/.test(lower)) deadlineInDays = 14;

  // --- category ----------------------------------------------------------
  let category = (defaults?.category as ParsedRequirement["category"]) ?? "software";
  let bestHits = 0;
  for (const [id, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = words.filter((w) => lower.includes(w)).length;
    if (hits > bestHits) {
      bestHits = hits;
      category = id as ParsedRequirement["category"];
    }
  }

  // --- tags --------------------------------------------------------------
  const tags = TAG_DICTIONARY.filter((t) => tagMatches(lower, t)).slice(0, 8);
  const inferredTags = tags.length >= 2 ? tags : [...tags, ...fallbackTags(category)].slice(0, 4);

  // --- must-haves --------------------------------------------------------
  const mustHaves = sentences
    .filter((s) => /\b(must|required|need(?:ed)?|mandatory|no more than|within|certified)\b/i.test(s))
    .map((s) => s.replace(/\s+/g, " ").slice(0, 150))
    .slice(0, 6);

  // --- location ----------------------------------------------------------
  const location =
    defaults?.location ??
    (/(remote|anywhere|worldwide)/i.test(brief)
      ? "Remote"
      : /\b(?:in|near|at)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?(?:,\s?[A-Z]{2})?)/.exec(brief)?.[1] ?? "Remote");

  const titleSource = sentences[0] ?? brief;
  const title = titleSource.replace(/\s+/g, " ").slice(0, 138);

  return {
    title: title.length >= 8 ? title : `${title} — requirement`.slice(0, 138),
    summary: (sentences[1] ?? sentences[0] ?? brief).replace(/\s+/g, " ").slice(0, 238),
    description: brief.trim().slice(0, 6000),
    category,
    budgetMax,
    budgetTarget: Math.min(budgetTarget, budgetMax),
    deadlineInDays: Math.max(3, Math.min(730, deadlineInDays)),
    closingInDays: 14,
    location,
    tags: inferredTags,
    mustHaves,
    confidence: Math.min(0.62, 0.18 + bestHits * 0.08 + tags.length * 0.05 + (money.length ? 0.12 : 0)),
    assumptions: [
      money.length ? `Budgets read from the brief: ${money.map((m) => `$${m.toLocaleString()}`).join(", ")}.` : `No budget stated — assumed a $${budgetMax.toLocaleString()} ceiling.`,
      `Delivery assumed at ${deadlineInDays} days from award.`,
      `Category inferred as ${category} from keyword frequency.`,
    ],
  };
}


const MONEY_UNITS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  m: 1_000_000,
  mn: 1_000_000,
  million: 1_000_000,
};

/**
 * Pull budget figures out of a brief.
 *
 * Two deliberate restrictions keep quantities out of the budget set: an amount
 * must either be written with a currency symbol, or be introduced by a money
 * word ("budget", "cost", "under"). The trailing `(?![a-z])` is what stops
 * "2000 moulded" from being read as 2000 million.
 */
export function extractMoney(brief: string): number[] {
  const found: number[] = [];

  const collect = (regex: RegExp, group: number, unitGroup: number) => {
    for (const match of brief.matchAll(regex)) {
      const raw = Number(match[group].replace(/[,\s]/g, ""));
      if (!Number.isFinite(raw) || raw <= 0) continue;
      const unit = (match[unitGroup] ?? "").toLowerCase();
      found.push(unit && MONEY_UNITS[unit] ? raw * MONEY_UNITS[unit] : raw);
    }
  };

  collect(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|mn|million|thousand)?(?![a-z\d])/gi, 1, 2);

  if (found.length === 0) {
    collect(
      /(?:budget|cost|price|spend|under|max(?:imum)?|cap|ceiling|around)\D{0,12}(\d[\d,]*(?:\.\d+)?)\s*(k|m|mn|million|thousand)?(?![a-z\d])/gi,
      1,
      2
    );
  }

  // Sub-$500 figures in a procurement brief are unit prices or noise, not a
  // project budget.
  return found.filter((n) => n >= 500);
}

/** Matches a dictionary tag against brief text, tolerating inflected forms. */
export function tagMatches(lowerBrief: string, tag: string): boolean {
  const lower = tag.toLowerCase();
  if (lowerBrief.includes(lower)) return true;
  const words = lower.split(/[\s-]+/).filter((w) => w.length >= 5);
  return words.length > 0 && words.every((w) => lowerBrief.includes(w.slice(0, Math.max(5, w.length - 3))));
}

function fallbackTags(category: string) {
  const map: Record<string, string[]> = {
    manufacturing: ["CNC", "Tooling", "ISO 9001"],
    software: ["TypeScript", "REST API", "Design system"],
    logistics: ["LTL", "Last mile", "Dedicated lane"],
    design: ["Identity", "Brand system", "Packaging"],
    construction: ["Fit-out", "MEP", "Permits"],
    electronics: ["SMT", "AOI", "Firmware"],
  };
  return map[category] ?? ["Prototyping"];
}

/* ======================================================================
   2. Semantic fit — how well a pitch actually answers the requirement
   ====================================================================== */

export async function scoreSemanticFit(
  requirement: Requirement,
  bid: Bid,
  provider?: Provider
): Promise<AiResponse<SemanticScore>> {
  return withFallback<SemanticScore>(
    async () => {
      const result = await chat<SemanticScore>(
        [
          {
            role: "system",
            content: systemPrompt(
              `Judge how well a supplier's proposal answers a buyer's requirement.\n\nScore 0-100 on substance only: does the pitch engage with the specific must-haves, quantities, standards and risks named in the requirement? Ignore price — that is scored separately. Reward concrete plans and named methods; penalise generic marketing language.\n\nReturn:\n{"score": integer 0-100,\n "verdict": string (max 160, one sentence a buyer can act on),\n "addressed": string[] (requirement points the pitch genuinely covers),\n "gaps": string[] (requirement points the pitch ignores or hand-waves),\n "confidence": number 0-1}`
            ),
          },
          {
            role: "user",
            content: [
              untrusted("requirement title", requirement.title),
              untrusted("requirement detail", requirement.description),
              untrusted("must-haves", requirement.mustHaves.join("\n")),
              untrusted("scored tags", requirement.tags.join(", ")),
              untrusted("proposal pitch", bid.pitch),
              untrusted("tags the supplier claims", bid.coversTags.join(", ")),
              untrusted(
                "supplier record",
                provider
                  ? `${provider.name} — ${provider.rating}★ over ${provider.reviews} reviews, ${provider.onTimeRate}% on time, ${provider.completedJobs} jobs, verified: ${provider.verified}`
                  : "unknown"
              ),
            ].join("\n\n"),
          },
        ],
        { schema: semanticScoreSchema, temperature: 0.1 }
      );
      return { data: result.value, meta: metaFrom(result) };
    },
    () => {
      const started = Date.now();
      return {
        data: heuristicSemanticFit(requirement, bid, provider),
        meta: heuristicMeta(started, "Scored by keyword coverage and specificity — no model was called."),
      };
    },
    "Semantic fit scoring"
  );
}

export interface SemanticBlendMeta extends AiMeta {
  /** Offers the model returned a usable score for. */
  scoredBids: number;
  /** Offers that were submitted for scoring. */
  requestedBids: number;
}

/**
 * Scores every live offer on a requirement so the ranking endpoint can blend
 * semantic fit into the total.
 *
 * Called only when a caller explicitly asks for semantic weighting — the
 * default comparison must never spend tokens. Results are cached by prompt
 * hash, so re-opening the same blended comparison is free.
 */
export async function scoreBidsForBlend(
  requirement: Requirement,
  bids: Bid[],
  providers: Provider[],
  limit = 12
): Promise<{ scores: Record<string, number>; meta: SemanticBlendMeta }> {
  const started = Date.now();
  const byId = new Map(providers.map((p) => [p.id, p]));
  const slice = bids
    .filter((b) => b.status !== "rejected")
    .slice(0, limit);

  const results = await Promise.all(
    slice.map((bid) =>
      scoreSemanticFit(requirement, bid, byId.get(bid.providerId)).catch(() => null)
    )
  );

  const scores: Record<string, number> = {};
  let mode: AiMeta["mode"] = "heuristic";
  let provider = "offline";
  let model = "xmarket-heuristic-v1";
  let cached = true;
  let latencyMs = 0;
  let failed = 0;

  slice.forEach((bid, i) => {
    const result = results[i];
    if (!result) {
      failed += 1;
      return;
    }
    scores[bid.id] = result.data.score;
    if (result.meta.mode === "llm") {
      mode = "llm";
      provider = result.meta.provider;
      model = result.meta.model;
      cached = cached && result.meta.cached;
      latencyMs = Math.max(latencyMs, result.meta.latencyMs);
    }
  });

  const scored = Object.keys(scores).length;
  if (mode === "heuristic") cached = false;
  const note =
    failed && scored
      ? `${scored} of ${slice.length} offers scored; ${failed} could not be judged and keep their deterministic total.`
      : failed && !scored
        ? "No offer could be judged; the ranking falls back to the deterministic factors."
        : `Semantic fit blended for ${scored} offer${scored === 1 ? "" : "s"} — cached per offer by prompt hash.`;

  return {
    scores,
    meta: {
      provider,
      model,
      mode,
      cached,
      latencyMs: latencyMs || Date.now() - started,
      note,
      scoredBids: scored,
      requestedBids: slice.length,
    },
  };
}

const STOP = new Set(
  "the a an and or of to in for with on at by is are be we our you your it its that this from will would can could as not no if then than so we'd we'll".split(" ")
);

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#/-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function heuristicSemanticFit(
  requirement: Requirement,
  bid: Bid,
  provider?: Provider
): SemanticScore {
  const reqTokens = new Set(tokens(`${requirement.title} ${requirement.description} ${requirement.mustHaves.join(" ")}`));
  const pitchTokens = new Set(tokens(bid.pitch));

  let overlap = 0;
  for (const t of pitchTokens) if (reqTokens.has(t)) overlap += 1;
  // Normalise against a capped denominator: long requirements should not make a
  // focused pitch look thin, but coverage still has to be earned.
  const coverage = Math.min(1, reqTokens.size ? overlap / Math.min(reqTokens.size, 30) : 0);

  const tagCoverage = requirement.tags.length
    ? bid.coversTags.filter((t) => requirement.tags.includes(t)).length / requirement.tags.length
    : 0;

  // Concrete proposals name numbers, methods and standards.
  const specificity = [
    /\b\d+(\.\d+)?\s?(mm|µm|um|kg|units?|days?|weeks?|hours?|%)\b/i,
    /\b(ISO|IPC|ANSI|ASTM|FDA|FCC|CE|UL)\s?\d*/i,
    /\b(milestone|fixture|stencil|fixture plan|tolerance|report|audit|calibrat)/i,
  ].filter((rx) => rx.test(bid.pitch)).length / 3;

  const lengthSignal = Math.min(1, bid.pitch.split(/\s+/).length / 90);
  const gaps: string[] = [];
  for (const tag of requirement.tags) {
    if (!bid.coversTags.includes(tag)) gaps.push(`Does not address “${tag}”.`);
  }

  // Tag coverage is the strongest single signal a buyer can verify, so it
  // carries the most weight; specificity rewards proposals that name numbers,
  // standards and methods instead of adjectives.
  const raw =
    coverage * 22 + tagCoverage * 40 + specificity * 22 + lengthSignal * 16;
  const score = Math.round(Math.max(5, Math.min(97, raw)));

  const addressed = bid.coversTags.filter((t) => requirement.tags.includes(t));

  return {
    score,
    verdict:
      score >= 78
        ? `Engages with ${addressed.length}/${requirement.tags.length} scored requirements and reads as specific.`
        : score >= 60
          ? `Covers the basics but leaves ${gaps.length} requirement${gaps.length === 1 ? "" : "s"} unaddressed.`
          : `Thin against this brief — the pitch is generic for the work described.`,
    addressed: addressed.map((t) => `Explicitly covers ${t}.`).slice(0, 6),
    gaps: gaps.slice(0, 6),
    confidence: Math.min(0.7, 0.25 + coverage + tagCoverage * 0.3),
  };
}

/* ======================================================================
   3. Bid drafting — help providers write a proposal worth scoring
   ====================================================================== */

export async function draftBid(
  requirement: Requirement,
  provider: Provider,
  params: { targetPrice?: number; deliveryDays?: number; notes?: string }
): Promise<AiResponse<DraftBid>> {
  const deliveryDays = params.deliveryDays ?? Math.round(requirement.budgetMax > 0 ? 30 : 30);

  return withFallback<DraftBid>(
    async () => {
      const result = await chat<DraftBid>(
        [
          {
            role: "system",
            content: systemPrompt(
              `Draft a supplier proposal for a procurement requirement.\n\nWrite in first person plural, plainly and specifically. Reference the buyer's actual must-haves and spec tags. Never invent certifications, past clients, machinery or guarantees that are not in the supplier record. If the supplier record lacks experience the requirement asks for, say what would be needed instead of claiming it.\n\nReturn:\n{"pitch": string (3 short paragraphs, max 4000 chars),\n "milestones": [{"label": string, "days": integer days from award}] (2-6, strictly increasing),\n "coversTags": string[] (subset of the requirement's scored tags the supplier can support),\n "risks": string[] (honest caveats)}\n\nThe final milestone must land on or before day ${deliveryDays}.`
            ),
          },
          {
            role: "user",
            content: [
              untrusted("requirement", `${requirement.title}\n\n${requirement.summary}\n\n${requirement.description}`),
              untrusted("must-haves", requirement.mustHaves.join("\n") || "none stated"),
              untrusted("scored tags", requirement.tags.join(", ")),
              untrusted("supplier profile", `${provider.name} — ${provider.tagline}. Skills: ${provider.skills.join(", ")}. Categories: ${provider.categories.join(", ")}. ${provider.rating}★ over ${provider.reviews} reviews, ${provider.onTimeRate}% on time, ${provider.completedJobs} jobs completed.`),
              untrusted("commercial parameters", `Offer price $${(params.targetPrice ?? requirement.budgetTarget).toLocaleString()}; delivery in ${deliveryDays} days.`),
              params.notes ? untrusted("supplier notes", params.notes) : "",
            ].filter(Boolean).join("\n\n"),
          },
        ],
        { schema: draftBidSchema, temperature: 0.6 }
      );
      return { data: result.value, meta: metaFrom(result) };
    },
    () => {
      const started = Date.now();
      return {
        data: heuristicDraft(requirement, provider, deliveryDays),
        meta: heuristicMeta(started, "Assembled from the supplier profile and requirement — edit before submitting."),
      };
    },
    "Bid drafting"
  );
}

export function heuristicDraft(
  requirement: Requirement,
  provider: Provider,
  deliveryDays: number
): DraftBid {
  const supported = requirement.tags.filter(
    (t) =>
      provider.skills.some((s) => s.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(s.toLowerCase())) ||
      provider.categories.includes(requirement.category)
  );
  const coversTags = supported.length ? supported : requirement.tags.slice(0, 3);

  const split = [
    { label: "Kick-off, scope confirmation and plan", days: Math.max(3, Math.round(deliveryDays * 0.15)) },
    { label: "Main delivery block", days: Math.max(7, Math.round(deliveryDays * 0.7)) },
    { label: "Review, acceptance and handover", days: deliveryDays },
  ].filter((m, i, arr) => i === 0 || m.days > arr[i - 1].days);

  const pitch = [
    `${provider.name} can take this on. ${provider.tagline}. For “${requirement.title}” we would work to your stated must-haves — ${requirement.mustHaves.slice(0, 3).join("; ") || "confirmed at kick-off"} — and flag any deviation in writing before it affects the schedule.`,
    `Our track record: ${provider.completedJobs} completed jobs, ${provider.onTimeRate}% delivered on time, ${provider.rating.toFixed(1)}★ across ${provider.reviews} reviews. We would schedule the work to land inside your window with buffer rather than promising the theoretical minimum.`,
    `On award we need the requirement inputs confirm, a named contact for decisions, and any compliance documentation you require. We will confirm those within two business days.`,
  ].join("\n\n");

  return {
    pitch,
    milestones: split,
    coversTags: coversTags.slice(0, 8),
    risks: [
      supported.length < requirement.tags.length
        ? `${requirement.tags.length - supported.length} scored tag(s) are outside the profile — confirm before claiming them.`
        : "No capability gaps detected against the scored tags.",
      "Delivery assumes inputs are supplied on time; late inputs shift the schedule.",
    ],
  };
}

/* ======================================================================
   4. Comparison summary — read the shortlist back to the buyer
   ====================================================================== */

export async function summarizeComparison(
  requirement: Requirement,
  bids: Bid[],
  providers: Provider[],
  weights: Weights,
  focus?: string
): Promise<AiResponse<ComparisonSummary & { rankedIds: string[] }>> {
  const ranked = rank(requirement, bids, providers, { weights });
  const top = ranked.slice(0, 4);

  const table = top
    .map(
      (row, i) =>
        `${i + 1}. ${row.provider?.name ?? row.bid.providerId} (id ${row.bid.providerId}) — $${row.bid.price.toLocaleString()}, ${row.bid.deliveryDays} days, engine score ${row.score.total}/100, budget ${row.score.factors.find((f) => f.key === "budget")?.score}, timeline ${row.score.factors.find((f) => f.key === "timeline")?.score}, relevance ${row.score.factors.find((f) => f.key === "relevance")?.score}. Pitch: ${row.bid.pitch.slice(0, 400)}`
    )
    .join("\n\n");

  return withFallback<ComparisonSummary & { rankedIds: string[] }>(
    async () => {
      const result = await chat<ComparisonSummary>(
        [
          {
            role: "system",
            content: systemPrompt(
              `Explain a shortlist of supplier offers to a buyer who has to justify the award to colleagues.\n\nGround every claim in the numbers and the pitches provided. Do not recompute or contradict the engine scores. Do not recommend a supplier whose score is not the highest unless price or timing clearly justifies it, and say so explicitly when you do.\n\nReturn:\n{"headline": string (max 200), "recommendation": string (2-4 sentences), "tradeoffs": [{"providerId": string, "strength": string, "risk": string}], "watchFor": string[], "confidence": number 0-1}`
            ),
          },
          {
            role: "user",
            content: [
              untrusted("requirement", `${requirement.title} — ${requirement.summary}. Ceiling $${requirement.budgetMax.toLocaleString()}, target $${requirement.budgetTarget.toLocaleString()}, needed by ${requirement.deadline.slice(0, 10)}.`),
              untrusted("must-haves", requirement.mustHaves.join("\n") || "none stated"),
              untrusted("ranked offers", table),
              untrusted("buyer priorities", `budget ${weights.budget}, timeline ${weights.timeline}, relevance ${weights.relevance}`),
              focus ? untrusted("buyer focus", focus) : "",
            ].filter(Boolean).join("\n\n"),
          },
        ],
        { schema: comparisonSummarySchema, temperature: 0.3 }
      );
      return {
        data: { ...result.value, rankedIds: top.map((r) => r.bid.id) },
        meta: metaFrom(result),
      };
    },
    () => {
      const started = Date.now();
      return {
        data: {
          ...heuristicSummary(requirement, ranked),
          rankedIds: top.map((r) => r.bid.id),
        },
        meta: heuristicMeta(started, "Computed from the engine factors — no model was called."),
      };
    },
    "Comparison summary"
  );
}

export function heuristicSummary(
  requirement: Requirement,
  ranked: ReturnType<typeof rank>
): ComparisonSummary {
  const best = ranked[0];
  const cheapest = [...ranked].sort((a, b) => a.bid.price - b.bid.price)[0];
  const fastest = [...ranked].sort((a, b) => a.bid.deliveryDays - b.bid.deliveryDays)[0];
  const spread = Math.max(...ranked.map((r) => r.bid.price)) - Math.min(...ranked.map((r) => r.bid.price));

  const cheapestIsBest = cheapest?.bid.id === best?.bid.id;
  const fastestIsBest = fastest?.bid.id === best?.bid.id;

  return {
    headline: best
      ? `${best.provider?.name} leads on compatibility at ${best.score.total}/100 with a $${spread.toLocaleString()} spread across the shortlist`
      : "No offers to compare yet",
    recommendation: best
      ? `The engine ranks ${best.provider?.name} first (${best.score.grade.toLowerCase()} fit): $${best.bid.price.toLocaleString()} delivered in ${best.bid.deliveryDays} days, against a $${requirement.budgetMax.toLocaleString()} ceiling. ${
          cheapestIsBest
            ? "It is also the cheapest offer, so price and fit agree."
            : `The cheapest offer is ${cheapest.provider?.name} at $${cheapest.bid.price.toLocaleString()}, $${(best.bid.price - cheapest.bid.price).toLocaleString()} more for the leading bid — check that the difference is covered by the stronger factors.`
        }`
      : "Post a requirement to start receiving scored offers.",
    tradeoffs: ranked.slice(0, 4).map((row) => ({
      providerId: row.bid.providerId,
      strength:
        row.score.factors
          .slice()
          .sort((a, b) => b.score - a.score)[0]?.detail ?? "Balanced across factors.",
      risk:
        row.score.risks[0] ??
        (row.bid.price > requirement.budgetTarget
          ? `Priced above the $${requirement.budgetTarget.toLocaleString()} target.`
          : "No significant risk flagged by the engine."),
    })),
    watchFor: [
      fastestIsBest ? "The fastest offer is also the strongest — timeline risk is low." : `Fastest delivery is ${fastest?.bid.deliveryDays} days from ${fastest?.provider?.name}; confirm that schedule is committed, not aspirational.`,
      `Budget scoring anchors on the $${requirement.budgetTarget.toLocaleString()} target, so offers above it lose points even when they sit under the ceiling.`,
      ...(best?.score.risks ?? []).slice(0, 1),
    ],
    confidence: Math.min(0.75, 0.35 + ranked.length * 0.08),
  };
}
