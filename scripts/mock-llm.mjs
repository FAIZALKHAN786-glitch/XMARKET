#!/usr/bin/env node
/**
 * A tiny OpenAI-compatible server for developing the AI features without a key
 * or a bill. It answers /v1/chat/completions with schema-valid JSON chosen by
 * inspecting the system prompt, and deliberately wraps one reply in prose and
 * code fences so the client-side JSON extraction is exercised too.
 *
 *   node scripts/mock-llm.mjs              # listens on :4010
 *   MESSY=0 node scripts/mock-llm.mjs      # return clean JSON only
 *
 * Then point the app at it:
 *   OPENAI_API_KEY=mock OPENAI_BASE_URL=http://127.0.0.1:4010/v1 OPENAI_MODEL=mock-gpt
 */

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 4010);
const MESSY = process.env.MESSY !== "0";
let calls = 0;

const parsedRequirement = {
  title: "2,000 injection moulded ABS sensor enclosures",
  summary:
    "Matte black ABS enclosures with a USB-C cutout, RoHS compliant, first articles in three weeks.",
  description:
    "We need 2,000 injection moulded ABS enclosures for a handheld sensor. Matte black, USB-C cutout, RoHS compliant. First articles are needed within three weeks and full delivery in eight weeks.\n\nWe would prefer a domestic moulder in the Detroit area. Unit cost target is $4.50, so the total budget sits around $9,000 with a hard ceiling of $12,000.",
  category: "manufacturing",
  budgetMax: 12000,
  budgetTarget: 9000,
  deadlineInDays: 56,
  closingInDays: 14,
  location: "Detroit, MI",
  tags: ["Injection moulding", "ABS", "RoHS", "Tooling", "First article"],
  mustHaves: ["RoHS compliant", "First articles within 3 weeks"],
  confidence: 0.86,
  assumptions: [
    "Assumed 2,000 units is the full order quantity.",
    "Assumed tooling cost is included in the quoted price.",
  ],
};

const semanticScore = {
  score: 88,
  verdict:
    "Directly addresses the tolerance, anodising and reporting requirements, with a credible first-article commitment.",
  addressed: [
    "Names in-house 5-axis capacity for the motor-mount bores.",
    "Commits to a per-batch CMM dimensional report.",
    "Confirms type II matte black anodising.",
    "States a nine-day first article.",
  ],
  gaps: ["Does not mention PPAP documentation explicitly."],
  confidence: 0.81,
};

const draftBid = {
  pitch:
    "We run the class of work you have described: five-axis cells dedicated to load-bearing enclosures, with anodising finished in-house rather than subcontracted. For this run we would machine a first article inside nine days and hold the motor-mount bores to ±0.02 mm, verified on a CMM with the report shipped alongside each batch.\n\nDelivery would be 34 days from award, which leaves twelve days of buffer against your deadline. We would machine in two lots so you can start assembly validation before the full quantity lands.\n\nWhat we need from you on award: the STEP pack, the GD&amp;T drawing list, and confirmation that the type II anodise specification is fixed. Anything we cannot meet we will raise in writing before cutting metal.",
  milestones: [
    { label: "DFM review and quote lock", days: 4 },
    { label: "First article with CMM report", days: 9 },
    { label: "Pilot lot of 250 units", days: 22 },
    { label: "Final 250 units and PPAP pack", days: 34 },
  ],
  coversTags: ["5-axis CNC", "Aluminium 6061", "Anodising", "PPAP", "ISO 9001"],
  risks: [
    "PPAP documentation is not currently in the quote — confirm before award.",
    "Would need your GD&T pack before the first-article date can be committed.",
  ],
};

const comparisonSummary = {
  headline:
    "Atlas Precision leads at 96/100 and is also the fastest bid, leaving Voltaic Assembly's $12,400 saving as the only real trade-off.",
  recommendation:
    "Atlas Precision is the strongest offer on every axis that matters here: it lands under your target price, delivers with twelve days of buffer, and covers all five scored requirements with in-house capability. Voltaic Assembly is cheaper by $12,400 but runs 21 days longer and only covers three of five tags, so the saving is carrying real schedule and scope risk.",
  tradeoffs: [
    {
      providerId: "p_atlas",
      strength: "In-house 5-axis, anodising and CMM reporting in a single supplier.",
      risk: "Highest unit price of the compliant bids.",
    },
    {
      providerId: "p_voltaic",
      strength: "Cheapest compliant offer at $61,800, a 20% saving against the ceiling.",
      risk: "55-day schedule and only partial tag coverage.",
    },
    {
      providerId: "p_kestrel",
      strength: "Fastest delivery at 28 days with assembly folded in.",
      risk: "Priced above target and less machining depth than Atlas.",
    },
  ],
  watchFor: [
    "Confirm PPAP documentation is inside the Atlas quote rather than a change order.",
    "Voltaic's price depends on a Monterrey partner — verify the anodising lot schedule.",
  ],
  confidence: 0.84,
};

/**
 * The judge prompt carries one proposal at a time, so the mock varies its score
 * by content. Without this every offer would come back identical and a blended
 * ranking would look suspiciously tidy.
 */
function semanticFor(bodyText) {
  const proposal = bodyText.split("proposal pitch").slice(1).join("proposal pitch");
  let h = 0;
  for (let i = 0; i < proposal.length; i++) {
    h = (h * 31 + proposal.charCodeAt(i)) % 100000;
  }
  const score = 42 + (h % 51); // 42 – 92
  return {
    ...semanticScore,
    score,
    confidence: Number((0.55 + (h % 30) / 100).toFixed(2)),
    verdict:
      score >= 75
        ? semanticScore.verdict
        : "Engages with the brief only partly: the price is clear but the technical commitments stay generic.",
  };
}

function pickContent(bodyText) {
  if (bodyText.includes("structured procurement requirement")) return parsedRequirement;
  if (bodyText.includes("Judge how well")) return semanticFor(bodyText);
  if (bodyText.includes("Draft a supplier proposal")) return draftBid;
  if (bodyText.includes("Explain a shortlist")) return comparisonSummary;
  return { note: "mock provider has no shape for this prompt" };
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.includes("/chat/completions")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    calls += 1;
    let prompt = raw;
    try {
      prompt = JSON.stringify(JSON.parse(raw));
    } catch {
      /* keep the raw body */
    }

    const content = pickContent(prompt);
    let text = JSON.stringify(content);

    // Every third reply is wrapped in prose and fences to exercise extractJson.
    if (MESSY && calls % 3 === 0) {
      text = `Sure — here is the JSON you asked for:\n\n\`\`\`json\n${text}\n\`\`\`\n\nLet me know if you need changes.`;
    }

    console.log(
      `[mock-llm] #${calls} ${text.length} chars ${MESSY && calls % 3 === 0 ? "(messy)" : ""}`
    );

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: `chatcmpl-mock-${calls}`,
        object: "chat.completion",
        model: "mock-gpt",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: text },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: raw.length / 4, completion_tokens: text.length / 4 },
      })
    );
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mock-llm] OpenAI-compatible endpoint on http://0.0.0.0:${PORT}/v1`);
  console.log(`[mock-llm] messy replies: ${MESSY ? "on" : "off"}`);
});
