#!/usr/bin/env node
/**
 * Exercises every AI endpoint against a running XMARKET server and reports
 * which engine answered each one. Run it after adding a key to confirm the
 * model is actually wired up rather than silently falling back.
 *
 *   npm run dev          # in one terminal
 *   npm run ai:check     # in another
 */

const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

let failures = 0;

async function call(path, init) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
  }
  return body.data;
}

function report(name, data, summarise) {
  const mode = data.meta?.mode ?? "unknown";
  const tag =
    mode === "llm"
      ? `${GREEN}MODEL${OFF}`
      : mode === "heuristic"
        ? `${YELLOW}HEURISTIC${OFF}`
        : `${RED}UNKNOWN${OFF}`;
  console.log(`  ${tag}  ${name}`);
  console.log(
    `         ${DIM}${data.meta?.provider ?? "?"} · ${data.meta?.model ?? "?"} · ${data.meta?.latencyMs ?? "?"}ms${data.meta?.cached ? " · cached" : ""}${OFF}`
  );
  if (data.meta?.note) console.log(`         ${DIM}${data.meta.note}${OFF}`);
  for (const line of summarise(data)) console.log(`         ${line}`);
  console.log();
}

async function main() {
  console.log(`\nXMARKET AI check — ${BASE}\n`);

  let status;
  try {
    status = await call("/api/ai/status");
  } catch (error) {
    console.error(
      `${RED}Cannot reach the server at ${BASE}.${OFF}\n` +
        `Start it with ${DIM}npm run dev${OFF} and try again.\n` +
        `${DIM}${error.message}${OFF}\n`
    );
    process.exit(1);
  }

  console.log(
    `  provider : ${status.provider}\n` +
      `  model    : ${status.model}\n` +
      `  live     : ${status.live ? `${GREEN}yes${OFF}` : `${YELLOW}no — heuristic mode${OFF}`}\n` +
      `  note     : ${DIM}${status.note}${OFF}\n`
  );

  // Pick a requirement that actually has offers for the scoring and summary tests.
  const feed = await call("/api/requirements?sort=offers&limit=1");
  const requirement = feed.requirements[0];

  const steps = [
    {
      name: "parse-requirement  brief -> structured requirement",
      run: () =>
        call("/api/ai/parse-requirement", {
          method: "POST",
          body: JSON.stringify({
            brief:
              "We need 2000 injection moulded ABS enclosures for a handheld sensor, matte black with a USB-C cutout. Unit cost target $4.50, total budget around $9,000 and we cannot exceed $12,000. Must be RoHS compliant. First articles in 3 weeks, full delivery in 8 weeks. We are in Detroit and prefer a domestic moulder.",
          }),
        }),
      summarise: (d) => [
        `category ${d.draft.category} | target $${d.draft.budgetTarget.toLocaleString()} / ceiling $${d.draft.budgetMax.toLocaleString()}`,
        `${d.draft.deadlineInDays} days | ${d.draft.location} | tags: ${d.draft.tags.join(", ")}`,
      ],
    },
    {
      name: "draft-bid           provider proposal draft",
      run: () =>
        call("/api/ai/draft-bid", {
          method: "POST",
          body: JSON.stringify({ requirementId: requirement.id, providerId: "p_atlas" }),
        }),
      summarise: (d) => [
        `${d.draft.pitch.length} chars | ${d.draft.milestones.length} milestones | covers ${d.draft.coversTags.length} tags`,
        `first milestone lands day ${d.draft.milestones[0]?.days}`,
      ],
    },
    {
      name: "summarize           shortlist narrative",
      run: () =>
        call("/api/ai/summarize", {
          method: "POST",
          body: JSON.stringify({ requirementId: requirement.id }),
        }),
      summarise: (d) => [
        d.summary.headline.slice(0, 96),
        `${d.offerCount} offers | ${d.summary.tradeoffs.length} tradeoffs | confidence ${Math.round(d.summary.confidence * 100)}%`,
      ],
    },
  ];

  const bids = await call(`/api/bids?requirementId=${requirement.id}&limit=1`);
  if (bids.bids[0]) {
    steps.push({
      name: "score-bid           semantic fit for one offer",
      run: () =>
        call("/api/ai/score-bid", {
          method: "POST",
          body: JSON.stringify({
            requirementId: requirement.id,
            bidId: bids.bids[0].id,
          }),
        }),
      summarise: (d) => [
        `score ${d.semantic.score}/100 | confidence ${Math.round(d.semantic.confidence * 100)}%`,
        d.semantic.verdict.slice(0, 96),
      ],
    });
  }

  for (const step of steps) {
    try {
      const data = await step.run();
      report(step.name, data, step.summarise);
    } catch (error) {
      failures += 1;
      console.log(`  ${RED}FAILED${OFF}   ${step.name}`);
      console.log(`         ${DIM}${error.message}${OFF}\n`);
    }
  }

  if (!status.live) {
    console.log(
      `${YELLOW}No model is configured, so every result above came from the heuristic engine.${OFF}\n` +
        `Add a key to ${DIM}.env.local${OFF} (see ${DIM}.env.example${OFF}) and restart the server to use a model.\n`
    );
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
