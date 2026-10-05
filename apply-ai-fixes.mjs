#!/usr/bin/env node
/**
 * XMARKET AI fixes - applied directly to your files, no git required.
 *
 *   node apply-ai-fixes.mjs           # apply
 *   node apply-ai-fixes.mjs --check   # report only, change nothing
 *
 * Why a script instead of a patch: the patch needed a git repository and a
 * download that preserves line endings exactly. This edits the files in place,
 * works whether or not you cloned or unzipped, is safe to run twice, and tells
 * you what it did instead of failing silently.
 *
 * Fixes three things:
 *   1. The budget parser treated a rate ("$2,400 a week") as a total budget.
 *   2. The default Gemini model is retired and returns HTTP 404.
 *   3. Gemini 3.x thinking tokens consumed the output budget.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const CHECK_ONLY = process.argv.includes("--check");
const root = process.cwd();

const GUARD = "/**\n * Language that means the buyer quoted a rate, not a total.\n *\n * This matters more than it looks: budgetMax is the denominator for every\n * score on a requirement, so a weekly rate published as a total makes every\n * genuine offer look ten times over budget and the whole ranking meaningless.\n * \"per week\", \"a month\", \"per pallet\", \"twice a week\" \u2014 all of these are\n * signs the figure on its own is not the value of the engagement.\n */\nconst RATE_LANGUAGE =\n  /\\b(per|a|an|each|every|twice a|once a|daily|weekly|fortnightly|monthly|quarterly|annually|hourly)\\s+(week|day|month|year|quarter|hour|shift|pallet|trip|drop|mile|km|unit|item|piece|head|seat|visit|call[- ]?out)\\b|\\b(weekly|daily|monthly|hourly|per[- ]unit|per[- ]week|per[- ]month|per[- ]pallet|per[- ]trip)\\b/i;\n\nfunction rateLanguageIn(brief: string) {\n  const match = brief.match(RATE_LANGUAGE);\n  return match?.[0];\n}\n\n/**\n * Last line of defence on the parsed budget, applied to model and heuristic\n * output alike. It never silently rewrites a figure the buyer stated \u2014 it\n * flags what it cannot verify, because a wrong ceiling is worse than a\n * questioned one.\n */\nfunction sanityCheck(draft: ParsedRequirement, brief: string): ParsedRequirement {\n  const assumptions = [...draft.assumptions];\n  let confidence = draft.confidence;\n  let budgetMax = draft.budgetMax;\n  let budgetTarget = draft.budgetTarget;\n\n  // 1. An implausibly small total cannot be the value of a whole engagement.\n  const floor = Number(process.env.XMARKET_MIN_BUDGET ?? 250);\n  if (Number.isFinite(budgetMax) && budgetMax > 0 && budgetMax < floor) {\n    assumptions.push(\n      `The parsed budget ($${budgetMax.toLocaleString()}) looked like a unit price or a rate rather than a total, ` +\n        `so it was raised to a $${floor.toLocaleString()} floor. Check this before publishing.`\n    );\n    budgetMax = floor;\n    budgetTarget = Math.min(budgetTarget, floor);\n    confidence = Math.min(confidence, 0.4);\n  }\n\n  // 2. The brief quotes a rate. Either the arithmetic is already spelled out\n  //    in the assumptions, or it is not \u2014 and then the ceiling needs checking.\n  const rate = rateLanguageIn(brief);\n  if (rate) {\n    // Only accept evidence of actual arithmetic. A generic \"delivery assumed in\n    // 98 days\" must not count \u2014 that mistake silently disabled this warning.\n    const explained = assumptions.some((a) =>\n      /[\u00d7xX*]\\s*[\\d$]|\\$\\s?[\\d,]+\\s*[\u00d7xX*]|\\bmultiplied\\b|\\btotal for the\\b/i.test(a)\n    );\n    if (!explained) {\n      assumptions.push(\n        `This brief quotes a rate (\"${rate}\"), so the ceiling above may be a rate rather than the total ` +\n          `for the whole engagement. Check that it reflects the full term before publishing.`\n      );\n      confidence = Math.min(confidence, 0.6);\n    }\n  }\n\n  if (assumptions.length === draft.assumptions.length && budgetMax === draft.budgetMax) {\n    return draft;\n  }\n  return { ...draft, budgetMax, budgetTarget, confidence, assumptions };\n}";

const THINK = "/**\n * Thinking budget for the current model, or undefined to omit the field.\n * 3.x takes `thinkingLevel`; 2.5 and earlier take nothing from us.\n */\nfunction thinkingConfig(model: string): { thinkingLevel: string } | undefined {\n  if (!/^gemini-3/i.test(model)) return undefined;\n  const level = (process.env.GEMINI_THINKING_LEVEL ?? \"low\").toLowerCase();\n  return { thinkingLevel: [\"low\", \"medium\", \"high\"].includes(level) ? level : \"low\" };\n}";

const GEN_INSERT = "        // Gemini 3.x reasons before answering, and those tokens come out of\n        // maxOutputTokens \u2014 enough of them truncates the JSON and looks like a\n        // model failure. These prompts are extraction, not deliberation, so ask\n        // for minimal thinking. The field only exists on 3.x; sending it to a\n        // 2.5 model is a 400.\n        ...(thinkingConfig(c.model) ? { thinkingConfig: thinkingConfig(c.model) } : {}),\n";

const RULES_TAIL = "\\n\\nBudget rules:\\n- budgetMax is the TOTAL value of the whole engagement in USD, never a rate, a unit price or a per-period figure.\\n- If the brief quotes a unit price (per unit, each, per item) and a quantity, multiply them.\\n- If it quotes a recurring or period rate (per week, per month, per pallet, per trip, daily) and a term or frequency, multiply out to the whole term.\\n- State the arithmetic in assumptions, e.g. \\\"$115 x 500 units = $57,500 ceiling\\\" or \\\"$2,400/week x 14 weeks = $33,600 ceiling\\\".\\n- Never emit a unit price or a weekly rate as budgetMax. If you cannot derive the total, infer a defensible total for the whole engagement and say so.\\n- If no budget is stated, infer a defensible range for the work described and list it as an assumption.";

const OLD_TAIL = "\\n\\nIf no budget is stated, infer a defensible range for the work described and list it as an assumption.";

const ENV_NEW = "# --- Google Gemini (recommended, free tier) ---------------------------------\n# Google retires Gemini models for new accounts regularly, and a retired model\n# returns HTTP 404 (\"no longer available to new users\") \u2014 the app reports this\n# as a bad_request with Google's own message, which names the replacement.\n# If that happens, set the model below to a current one.\n# Current models: https://ai.google.dev/gemini-api/docs/models\n#\n# GEMINI_API_KEY=AIza...  (or AQ.... \u2014 both work, the app never inspects the prefix)\n# GEMINI_MODEL=gemini-3.8-flash\n#\n# Gemini 3.x reasons before answering and those tokens come out of the response\n# budget, so the client asks for minimal thinking by default. Raise it only if\n# you want deeper deliberation: low | medium | high\n# GEMINI_THINKING_LEVEL=low";

const OLD_ENV = "# --- Google Gemini (recommended, free tier) ---------------------------------\n# GEMINI_API_KEY=AIza...\n# GEMINI_MODEL=gemini-2.5-flash";

/* ------------------------------------------------------------------ helpers */

const results = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!existsSync(file)) return null;
  return { file, text: readFileSync(file, "utf8") };
}

function write(rel, text) {
  writeFileSync(path.join(root, rel), text, "utf8");
}

function record(ok, label, detail) {
  results.push({ ok, label, detail });
}

/** Replaces the first occurrence inside a named function only. */
function withinFunction(text, marker, edit) {
  const start = text.indexOf(marker);
  if (start === -1) return { text, applied: false, reason: `could not find ${marker}` };
  const nextExport = text.indexOf("\nexport ", start + marker.length);
  const end = nextExport === -1 ? text.length : nextExport;
  const scope = text.slice(start, end);
  const edited = edit(scope);
  if (edited === scope) return { text, applied: false, reason: "no change needed" };
  return { text: text.slice(0, start) + edited + text.slice(end), applied: true };
}

/* --------------------------------------------------------------------- main */

if (!existsSync(path.join(root, "package.json"))) {
  console.error(
    `\n  This is not the project folder - no package.json in ${root}\n` +
      `  Run it from the folder that contains package.json (app/, lib/, components/).\n`
  );
  process.exit(1);
}

/* ------------------------------------------------------------ lib/server/llm.ts */

{
  const rel = "lib/server/llm.ts";
  const file = read(rel);
  if (!file) {
    record(false, rel, "file not found");
  } else {
    let t = file.text;

    // 1. Current default model.
    if (/pick\("GEMINI_MODEL",\s*"gemini-3\.8-flash"\)/.test(t)) {
      record(true, `${rel} - default model`, "already gemini-3.8-flash");
    } else if (/pick\("GEMINI_MODEL",\s*"[^"]*"\)/.test(t)) {
      t = t.replace(
        /pick\("GEMINI_MODEL",\s*"[^"]*"\)/,
        () => 'pick("GEMINI_MODEL", "gemini-3.8-flash")'
      );
      record(true, `${rel} - default model`, "set to gemini-3.8-flash");
    } else {
      record(false, `${rel} - default model`, "could not find the GEMINI_MODEL default");
    }

    // 2. Thinking cap: helper + the field in generationConfig.
    //    Skipped as a pair if this file already mentions thinkingConfig, so a
    //    different implementation is never half-overwritten.
    if (/thinkingConfig/.test(t)) {
      record(true, `${rel} - thinking cap`, "already present - left as is");
    } else {
      const helperAnchor = "function endpoint(c: Config) {";
      if (t.includes(helperAnchor)) {
        t = t.replace(helperAnchor, () => THINK + "\n\n" + helperAnchor);
        record(true, `${rel} - thinking helper`, "added");
      } else {
        record(false, `${rel} - thinking helper`, `anchor missing: ${helperAnchor}`);
      }

      const genAnchor =
        '        responseMimeType: options.schema ? "application/json" : "text/plain",\n';
      const hits = t.split(genAnchor).length - 1;
      if (hits === 1) {
        t = t.replace(genAnchor, () => genAnchor + GEN_INSERT);
        record(true, `${rel} - thinking field`, "added to generationConfig");
      } else {
        record(false, `${rel} - thinking field`, `expected 1 anchor, found ${hits}`);
      }
    }

    if (t !== file.text && !CHECK_ONLY) write(rel, t);
  }
}

/* ------------------------------------------------------------- lib/server/ai.ts */

{
  const rel = "lib/server/ai.ts";
  const file = read(rel);
  if (!file) {
    record(false, rel, "file not found");
  } else {
    let t = file.text;

    // 1. The prompt rules.
    if (t.includes("Budget rules:")) {
      record(true, `${rel} - budget prompt rules`, "already present");
    } else if (t.includes(OLD_TAIL)) {
      t = t.replace(OLD_TAIL, () => RULES_TAIL);
      record(true, `${rel} - budget prompt rules`, "added");
    } else {
      record(false, `${rel} - budget prompt rules`, "could not find the prompt sentence to replace");
    }

    // 2. The rate guard.
    if (t.includes("function sanityCheck(")) {
      record(true, `${rel} - rate guard`, "already present");
    } else {
      const anchor = "export function heuristicParse(";
      if (t.includes(anchor)) {
        t = t.replace(anchor, () => GUARD + "\n\n" + anchor);
        record(true, `${rel} - rate guard`, "added");
      } else {
        record(false, `${rel} - rate guard`, `anchor missing: ${anchor}`);
      }
    }

    // 3. Wire it in, scoped to parseRequirement. The same "data: result.value"
    //    line exists in every capability, so an unscoped replace would corrupt
    //    the other three.
    if (t.includes("sanityCheck(result.value")) {
      record(true, `${rel} - call sites`, "already wired");
    } else {
      const model = withinFunction(t, "export async function parseRequirement(", (scope) =>
        scope.replace(
          "data: result.value, meta: metaFrom(result)",
          () => "data: sanityCheck(result.value, brief), meta: metaFrom(result)"
        )
      );
      t = model.text;
      record(model.applied, `${rel} - call site (model path)`, model.applied ? "wired" : model.reason);

      const offline = withinFunction(t, "export async function parseRequirement(", (scope) =>
        scope.replace(
          "data: heuristicParse(brief, defaults),",
          () => "data: sanityCheck(heuristicParse(brief, defaults), brief),"
        )
      );
      t = offline.text;
      record(
        offline.applied,
        `${rel} - call site (fallback path)`,
        offline.applied ? "wired" : offline.reason
      );
    }

    if (t !== file.text && !CHECK_ONLY) write(rel, t);
  }
}

/* ----------------------------------------------------------------- .env.example */

{
  const rel = ".env.example";
  const file = read(rel);
  if (!file) {
    record(false, rel, "file not found");
  } else if (file.text.includes("GEMINI_THINKING_LEVEL")) {
    record(true, `${rel} - Gemini block`, "already updated");
  } else if (file.text.includes(OLD_ENV)) {
    if (!CHECK_ONLY) write(rel, file.text.replace(OLD_ENV, () => ENV_NEW));
    record(true, `${rel} - Gemini block`, "updated");
  } else {
    record(false, `${rel} - Gemini block`, "could not find the Gemini block");
  }
}

/* ------------------------------------------------------------------- report */

console.log(`\nXMARKET AI fixes${CHECK_ONLY ? " (check only - nothing written)" : ""}\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "OK   " : "FAIL "} ${r.label.padEnd(38)} ${r.detail}`);
}

const failed = results.filter((r) => !r.ok).length;
if (failed) {
  console.log(
    `\n  ${failed} step(s) could not be applied - nothing was forced.\n` +
      `  Send this output back and I will adapt the script to your files.\n`
  );
  process.exit(1);
}

console.log(
  `\n  All changes applied.${CHECK_ONLY ? " Re-run without --check to write them." : ""}\n` +
    `  Next:\n` +
    `    npx tsc --noEmit      (silence = clean)\n` +
    `    npm run dev           (restart, then Clear AI cache in the status chip)\n`
);
