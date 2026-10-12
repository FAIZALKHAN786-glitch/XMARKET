#!/usr/bin/env node
/**
 * Exercises every AI endpoint against a running XMARKET server and reports
 * which engine answered each one. Run it after adding a key to confirm the
 * model is actually wired up rather than silently falling back.
 *
 *   npm run dev          # in one terminal
 *   npm run ai:check     # in another
 *   npm run ai:check -- --json   # machine-readable, for CI
 *
 * The first thing it does is probe the provider with a real request. A key
 * that is present but rejected — wrong, revoked, out of quota — is reported as
 * a failure here, which is the whole point: otherwise every capability below
 * would quietly report itself as working.
 */

const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

let failures = 0;
let probeFailed = false;
const results = [];
const FASTAPI = process.argv.includes("--backend=fastapi");
const PROBE_ONLY = process.argv.includes("--probe-only");
const JSON_OUT = process.argv.includes("--json");

async function call(path, init) {
  const endpoint = FASTAPI ? path.replace(/^\/api\/ai\//, "/fastapi/v1/ai/") : path;
  const response = await fetch(`${BASE}${endpoint}`, {
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
  results.push({
    capability: name.trim().split(/\s{2,}/)[0],
    mode: data.meta?.mode ?? "unknown",
    provider: data.meta?.provider ?? null,
    model: data.meta?.model ?? null,
    latencyMs: data.meta?.latencyMs ?? null,
    cached: Boolean(data.meta?.cached),
    note: data.meta?.note ?? null,
  });
  const mode = data.meta?.mode ?? "unknown";
  if (mode !== "llm") failures += 1;
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

  if (!status.live) {
    failures += 1;
    probeFailed = true;
    console.log("  No live provider configured. Set GEMINI_API_KEY and restart the serving backend.");
  }

  // Probe first: "a key is configured" is not "the key works".
  if (status.live) {
    process.stdout.write(`  probing ${status.provider}… `);
    try {
      const probed = await call("/api/ai/status?probe=1");
      const probe = probed.probe;
      if (probe?.ok) {
        console.log(`${GREEN}ok${OFF} ${DIM}(${probe.latencyMs}ms)${OFF}\n`);
        results.push({ capability: "provider-probe", mode: "llm", ok: true });
      } else {
        console.log(`${RED}FAILED${OFF}\n`);
        console.log(`  ${RED}The provider rejected the request.${OFF}`);
        console.log(`  ${probe?.detail ?? "No detail returned."}\n`);
        console.log(
          probe?.code === "rate_limited"
            ? `  ${YELLOW}This is a quota limit, not a bad key. Free tiers reset on a rolling window — try again later, or switch model.${OFF}\n`
            : probe?.code === "auth"
              ? `  ${YELLOW}Check the key is copied whole, is enabled for the Generative Language API, and has no IP restriction.${OFF}\n`
              : ""
        );
        failures += 1;
        probeFailed = true;
        results.push({
          capability: "provider-probe",
          mode: "failed",
          ok: false,
          code: probe?.code ?? null,
          detail: probe?.detail ?? null,
        });
      }
    } catch (error) {
      console.log(`${RED}FAILED${OFF}\n  ${error.message}\n`);
      failures += 1;
      probeFailed = true;
      results.push({ capability: "provider-probe", mode: "failed", ok: false });
    }
  }

  if (PROBE_ONLY || probeFailed) {
    if (JSON_OUT) console.log(JSON.stringify({ provider: status.provider, model: status.model, failures, results }, null, 2));
    process.exit(failures > 0 ? 1 : 0);
  }

  // Pick a requirement that actually has offers for the scoring and summary
  // tests. On an empty store there may be none, so bail out clearly rather
  // than reporting four failures that are really one missing fixture.
  const feed = await call("/api/requirements?sort=offers&limit=1");
  const requirement = feed.requirements[0];
  const offerCount = requirement?.offerCount ?? 0;
  if (!requirement || offerCount === 0) {
    console.log(
      `${YELLOW}No requirement with offers found.${OFF}\n` +
        `The scoring and summary checks need one. Import or post something first:\n` +
        `  ${DIM}npm run data:import -- --source=sample${OFF}\n` +
        `  ${DIM}POST /api/admin/reset?scope=data${OFF} restores the demo dataset.\n`
    );
    process.exit(failures > 0 ? 1 : 0);
  }
  console.log(`  using requirement: ${DIM}${requirement.title.slice(0, 60)} (${offerCount} offers)${OFF}\n`);

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

  if (probeFailed) {
    console.log(
      `  ${RED}${"-".repeat(64)}${OFF}\n` +
        `  ${RED}The provider is not answering, so read the results below carefully.${OFF}\n` +
        `  ${DIM}Anything marked "cached" is a reply stored from an earlier run — it proves\n` +
        `  the wiring works when a model IS reachable, not that your current key does.${OFF}\n`
    );
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

  if (probeFailed) {
    console.log(
      `${RED}RESULT: the provider rejected the request — see the probe output above.${OFF}\n` +
        `${DIM}Common causes: the key is wrong or revoked, the Generative Language API is not\n` +
        `enabled for the project, billing/quota is exhausted, or the key has an IP restriction.${OFF}\n`
    );
  }

  if (!status.live) {
    console.log(
      `${YELLOW}No model is configured, so every result above came from the heuristic engine.${OFF}\n` +
        `Add a key to ${DIM}.env.local${OFF} (see ${DIM}.env.example${OFF}) and restart the server to use a model.\n` +
        `${DIM}Free option: GEMINI_API_KEY from https://aistudio.google.com/apikey${OFF}\n`
    );
  }

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          base: BASE,
          provider: status.provider,
          model: status.model,
          live: status.live,
          failures,
          results,
        },
        null,
        2
      )
    );
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
