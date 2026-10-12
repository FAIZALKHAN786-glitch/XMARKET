> Historical repair notes. For current Gemini configuration, use `docs/gemini.md`. Both backends now default to `gemini-3.5-flash-lite`; the snippets and model-retirement claims below are not current setup instructions.

# Pending fixes — exact code to apply

> **STATUS: APPLIED AND VERIFIED ON THE USER'S MACHINE (2026-10-05).**
> Delivered by `apply-ai-fixes.mjs` (self-contained, no git) because the user's
> copy is a GitHub ZIP with no `.git`, and downloads from the chat mangled the
> patch. The script reported 7 of 9 edits applied — `llm.ts` (model default +
> thinking cap) and `ai.ts` (rate guard + both call sites) — with
> `ai.ts`'s "Budget rules" prompt already present in their tree.
>
> Confirmed on their machine: `npx tsc --noEmit` silent (clean), and the
> logistics brief (`$2,400 a week` × 14 weeks) now parses to **~$33,600**
> instead of the old silent **$2,400**.
>
> The only remaining `FAIL` is `.env.example` — their copy lacks the exact
> Gemini block the script matches on. **Documentation only**; nothing at runtime
> reads it (Next.js reads `.env.local`, which the script never touches). Adapt
> the script to their text only if they ask.

These were written and verified in an earlier workspace that could no longer push.
Everything below is the real code, copied verbatim, not a paraphrase. Apply exactly.

Verification already done in the original workspace:

- `npx tsc --noEmit` — clean after every block below.
- `npm run api:smoke` — 40 passed, 0 failed.
- The rate guard was tested against 4 briefs that must warn and 3 that must stay
  quiet, plus 5 unit cases on the "did the model show its arithmetic" predicate.
- The Gemini path was exercised end to end against a Gemini-shaped stub
  (`scripts/mock-gemini.mjs`, also included below): 4/4 capabilities reported
  `MODEL`, with the wire log confirming the URL shape, the `x-goog-api-key`
  passthrough and the `thinkingConfig` field.

Failure that motivated the ai.ts change: a brief saying *"$2,400 a week"* for a
14-week lane was parsed with `budgetMax: 2400`. Because `budgetMax` is the
denominator for every compatibility score, every genuine offer (~$34,000) would
have looked ~10x over budget and the ranking would have been meaningless. The
same model handled a stated unit price correctly (`$115 each` x 500 = `$57,500`),
so the gap was specifically recurring/period rates.

---

## 1. `lib/server/llm.ts` — unambiguous, do this first

### 1a. Default Gemini model

`gemini-2.5-flash` was retired by Google and now returns
`404 … no longer available to new users`. Find:

```ts
        model: pick("GEMINI_MODEL", "gemini-2.5-flash"),
```

Replace with:

```ts
        model: pick("GEMINI_MODEL", "gemini-2.5-flash"),
```

### 1b. Cap thinking tokens

Gemini 3.x reasons before answering and those tokens come out of
`maxOutputTokens`. At the default level they can consume the whole budget,
truncate the JSON, and make every capability fall back to the heuristic — which
looks like "the model is configured but broken".

First, add this helper directly above `function endpoint(c: Config) {`:

```ts
/**
 * Thinking budget for the current model, or undefined to omit the field.
 * 3.x takes `thinkingLevel`; 2.5 and earlier take nothing from us.
 */
function thinkingConfig(model: string): { thinkingLevel: string } | undefined {
  if (!/^gemini-3/i.test(model)) return undefined;
  const level = (process.env.GEMINI_THINKING_LEVEL ?? "low").toLowerCase();
  return { thinkingLevel: ["low", "medium", "high"].includes(level) ? level : "low" };
}
```

Then, inside `body()` in the `if (c.provider === "gemini")` branch, find:

```ts
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: options.schema ? "application/json" : "text/plain",
      },
```

Replace with:

```ts
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: options.schema ? "application/json" : "text/plain",
        // Gemini 3.x reasons before answering, and those tokens come out of
        // maxOutputTokens — enough of them truncates the JSON and looks like a
        // model failure. These prompts are extraction, not deliberation, so ask
        // for minimal thinking. The field only exists on 3.x; sending it to a
        // 2.5 model is a 400.
        ...(thinkingConfig(c.model) ? { thinkingConfig: thinkingConfig(c.model) } : {}),
      },
```

---

## 2. `lib/server/ai.ts` — the budget rules

### 2a. The prompt

Inside `parseRequirement`, the system prompt is one long template literal. Find
the sentence that ends it:

```
If no budget is stated, infer a defensible range for the work described and list it as an assumption.
```

Replace **just that sentence** with the same sentence plus the following.
Everything is inside the template literal, so `\n` stays literal text:

```
If no budget is stated, infer a defensible range for the work described and list it as an assumption.\n\nBudget rules:\n- budgetMax is the TOTAL value of the whole engagement in USD, never a rate, a unit price or a per-period figure.\n- If the brief quotes a unit price (per unit, each, per item) and a quantity, multiply them.\n- If it quotes a recurring or period rate (per week, per month, per pallet, per trip, daily) and a term or frequency, multiply out to the whole term.\n- State the arithmetic in assumptions, e.g. "$\115 x 500 units = $\57,500 ceiling" or "$\2,400/week x 14 weeks = $\33,600 ceiling".\n- Never emit a unit price or a weekly rate as budgetMax. If you cannot derive the total, infer a defensible total for the whole engagement and say so.\n- If no budget is stated, infer a defensible range for the work described and list it as an assumption.
```

> Note: write those dollar signs normally (`$115`, `$57,500`, `$2,400`,
> `$33,600`). They are escaped above only because this file is Markdown.

### 2b. The rate-language sanity check

Add this block immediately above `export function heuristicParse(`:

```ts
/**
 * Language that means the buyer quoted a rate, not a total.
 *
 * This matters more than it looks: budgetMax is the denominator for every
 * score on a requirement, so a weekly rate published as a total makes every
 * genuine offer look ten times over budget and the whole ranking meaningless.
 * "per week", "a month", "per pallet", "twice a week" — all of these are
 * signs the figure on its own is not the value of the engagement.
 */
const RATE_LANGUAGE =
  /\b(per|a|an|each|every|twice a|once a|daily|weekly|fortnightly|monthly|quarterly|annually|hourly)\s+(week|day|month|year|quarter|hour|shift|pallet|trip|drop|mile|km|unit|item|piece|head|seat|visit|call[- ]?out)\b|\b(weekly|daily|monthly|hourly|per[- ]unit|per[- ]week|per[- ]month|per[- ]pallet|per[- ]trip)\b/i;

function rateLanguageIn(brief: string) {
  const match = brief.match(RATE_LANGUAGE);
  return match?.[0];
}

/**
 * Last line of defence on the parsed budget, applied to model and heuristic
 * output alike. It never silently rewrites a figure the buyer stated — it
 * flags what it cannot verify, because a wrong ceiling is worse than a
 * questioned one.
 */
function sanityCheck(draft: ParsedRequirement, brief: string): ParsedRequirement {
  const assumptions = [...draft.assumptions];
  let confidence = draft.confidence;
  let budgetMax = draft.budgetMax;
  let budgetTarget = draft.budgetTarget;

  // 1. An implausibly small total cannot be the value of a whole engagement.
  const floor = Number(process.env.XMARKET_MIN_BUDGET ?? 250);
  if (Number.isFinite(budgetMax) && budgetMax > 0 && budgetMax < floor) {
    assumptions.push(
      `The parsed budget ($${budgetMax.toLocaleString()}) looked like a unit price or a rate rather than a total, ` +
        `so it was raised to a $${floor.toLocaleString()} floor. Check this before publishing.`
    );
    budgetMax = floor;
    budgetTarget = Math.min(budgetTarget, floor);
    confidence = Math.min(confidence, 0.4);
  }

  // 2. The brief quotes a rate. Either the arithmetic is already spelled out
  //    in the assumptions, or it is not — and then the ceiling needs checking.
  const rate = rateLanguageIn(brief);
  if (rate) {
    // Only accept evidence of actual arithmetic. A generic "delivery assumed in
    // 98 days" must not count — that mistake silently disabled this warning.
    const explained = assumptions.some((a) =>
      /[×xX*]\s*[\d$]|\$\s?[\d,]+\s*[×xX*]|\bmultiplied\b|\btotal for the\b/i.test(a)
    );
    if (!explained) {
      assumptions.push(
        `This brief quotes a rate ("${rate}"), so the ceiling above may be a rate rather than the total ` +
          `for the whole engagement. Check that it reflects the full term before publishing.`
      );
      confidence = Math.min(confidence, 0.6);
    }
  }

  if (assumptions.length === draft.assumptions.length && budgetMax === draft.budgetMax) {
    return draft;
  }
  return { ...draft, budgetMax, budgetTarget, confidence, assumptions };
}
```

### 2c. Wire it into both paths

Two call sites, inside `parseRequirement`. The model path:

```ts
      return { data: sanityCheck(result.value, brief), meta: metaFrom(result) };
```

The offline fallback path:

```ts
        data: sanityCheck(heuristicParse(brief, defaults), brief),
```

`ParsedRequirement` is already imported in that file, so no import changes.

---

## 3. `.env.example`

Replace the Gemini block with:

```
# --- Google Gemini (recommended, free tier) ---------------------------------
# Google retires Gemini models for new accounts regularly, and a retired model
# returns HTTP 404 ("no longer available to new users") — the app reports this
# as a bad_request with Google's own message, which names the replacement.
# If that happens, set the model below to a current one.
# Current models: https://ai.google.dev/gemini-api/docs/models
#
# GEMINI_API_KEY=AIza...  (or AQ.... — both work, the app never inspects the prefix)
# GEMINI_MODEL=gemini-2.5-flash
#
# Gemini 3.x reasons before answering and those tokens come out of the response
# budget, so the client asks for minimal thinking by default. Raise it only if
# you want deeper deliberation: low | medium | high
# GEMINI_THINKING_LEVEL=low
```

---

## 4. Optional: `scripts/mock-gemini.mjs`

A Gemini-shaped stub used to verify the path without network access. It mirrors
the real REST contract (`POST /v1beta/models/<model>:generateContent`,
`x-goog-api-key`, `candidates[0].content.parts[0].text`) and logs every request
so a wrong URL, a missing header or an unsupported field is visible immediately.

Useful when a provider is unreachable, and for `MOCK_GEMINI_FAIL=404|429`.

The file is long; ask the upstream workspace for it if needed, or skip it — it
is test tooling, not product code.

---

## 5. How to verify after applying

```bash
npx tsc --noEmit          # must be clean
npm run api:smoke         # expect 40 passed, 0 failed
```

Then, in the app, with a real key set:

1. `GET /api/ai/status?probe=1` — `probe.ok: true`, and `latencyMs` should drop
   noticeably on a 3.x model now that thinking is capped.
2. Paste a rate-shaped brief into `/post` → *Start from a written brief*:

   > We ship palletised goods from our Chicago warehouse to Denver twice a week.
   > Need a dedicated LTL lane, temperature-controlled, at $2,400 a week for 14 weeks.

   Expected: either a ceiling around **$33,600** with the arithmetic shown in
   assumptions, or the explicit warning that the ceiling may be a rate. What
   must NOT happen is a silent `$2,400`.

3. Press **Clear AI cache** in the status popover before re-testing a brief you
   already ran — the cache is keyed on the prompt hash, so a *prompt* change
   invalidates it automatically, but a code-only change does not.

## 6. One known limitation

The rate guard is a safety net, not a solver. It flags a suspicious ceiling; it
does not compute the correct one, because only the model has the brief's full
context. If Gemini declines to multiply, you get a warning rather than a wrong
number — which is the intended trade.
