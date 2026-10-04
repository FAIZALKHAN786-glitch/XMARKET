#!/usr/bin/env node
/**
 * XMARKET tender importer.
 *
 * Pulls REAL open procurement notices and loads them as requirements, so the
 * marketplace is populated from published data rather than invented examples.
 *
 *   npm run data:import -- --source=sample            # bundled fixture, no network
 *   npm run data:import -- --dry-run                  # live fetch, report only
 *   npm run data:import -- --keyword=software --limit=25
 *   npm run data:import -- --source=ocds --file=feed.json
 *   npm run data:import -- --source=ocds --url=https://example.org/ocds.json
 *
 * Sources
 *   contracts-finder  UK Contracts Finder (default). Open, no API key, no
 *                     signup. Notices are published by UK public bodies.
 *   ocds              Any Open Contracting Data Standard export, from a file
 *                     or a URL (Find a Tender, TED, national portals).
 *   sample            A bundled fixture in ./scripts/fixtures, used by the test
 *                     suite. Clearly not live data — do not treat it as real.
 *
 * The script only maps and validates; the server owns persistence, validation
 * and de-duplication (POST /api/admin/import).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const CONTRACTS_FINDER_URL =
  "https://www.contractsfinder.service.gov.uk/api/rest/2/search_notices/json";

/* ------------------------------------------------------------------ arguments */

const args = new Map();
for (const raw of process.argv.slice(2)) {
  const [key, ...rest] = raw.replace(/^--/, "").split("=");
  args.set(key, rest.join("=") || "true");
}
const has = (k) => args.has(k);
const get = (k, fallback) => args.get(k) ?? fallback;
const num = (k, fallback) => {
  const v = Number(args.get(k));
  return Number.isFinite(v) ? v : fallback;
};

const SOURCE = get("source", "contracts-finder");
const LIMIT = num("limit", 30);
const DRY_RUN = has("dry-run") || has("dryRun");
const INCLUDE_CLOSED = has("include-closed");
const MIN_VALUE = num("min-value", 0);
const KEYWORD = get("keyword", "");
const API = get("api", process.env.XMARKET_API ?? "http://127.0.0.1:3000");
const PAGE_SIZE = Math.min(num("page-size", 100), 1000);

/* -------------------------------------------------------------------- helpers */

/** Contracts Finder HTML-encodes field values; decode the common entities. */
function decode(value) {
  if (typeof value !== "string") return "";
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    pound: "£",
    euro: "€",
    hellip: "…",
    mdash: "—",
    ndash: "–",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function clean(value, max = 100000) {
  return decode(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function words(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#/-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

const STOP = new Set(
  "the and for with that this from are was were will shall have has had not but you your our their its can may any all one two use used using supply supplies provision provide services service contract contracts agreement opportunity tender notice required requirement requirements including include includes".split(
    " "
  )
);

/** Stable id from a source value, so re-imports map to the same record. */
function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * CPV is the EU procurement classification. Its first two digits are the
 * division, which maps onto XMARKET's categories well enough to seed the
 * engine — the importer never guesses beyond this table.
 */
const CPV_CATEGORY = [
  [/^45/, "construction"],
  [/^44|^14|^24|^31|^34|^35|^42|^43|^38/, "manufacturing"],
  [/^30|^32|^33|^48|^72|^73|^79|^85/, "software"],
  [/^60|^63|^64|^66/, "logistics"],
  [/^22|^37|^39|^58|^74|^75|^77|^79|^92/, "design"],
];

const CATEGORY_HINTS = [
  ["construction", /\b(fit[- ]?out|refurbish|building|roof|mep|scaffold|groundwork|hvac|construction|demolition)\b/],
  ["software", /\b(software|platform|api|dashboard|data|digital|website|cloud|system integration|it support|saas|cyber)\b/],
  ["logistics", /\b(freight|haulage|distribution|warehous|cold chain|last mile|transport|pallet|carriage)\b/],
  ["design", /\b(design|brand|identity|packaging|artwork|creative|illustrat|ux|ui|marketing collateral)\b/],
  ["electronics", /\b(pcb|pcba|electronic|firmware|sensor|circuit|embedded|semiconductor|wiring)\b/],
  ["manufacturing", /\b(manufactur|machin|cnc|tooling|mould|mold|fabricat|assembly|casting|welding|component|sheet metal)\b/],
];

function categoryFor(cpvCodes, ...text) {
  for (const code of cpvCodes) {
    const digits = String(code).replace(/\D/g, "");
    if (!digits) continue;
    for (const [pattern, category] of CPV_CATEGORY) {
      if (pattern.test(digits)) return category;
    }
  }
  const haystack = text.join(" ").toLowerCase();
  for (const [category, pattern] of CATEGORY_HINTS) {
    if (pattern.test(haystack)) return category;
  }
  return "manufacturing";
}

function tagsFor(cpvCodes, title, description) {
  const tags = new Set();
  for (const code of cpvCodes.slice(0, 4)) {
    const digits = String(code).replace(/\D/g, "");
    if (digits) tags.add(`CPV ${digits.slice(0, 5)}`);
  }
  for (const word of words(title).concat(words(description).slice(0, 40))) {
    if (STOP.has(word) || word.length < 4) continue;
    tags.add(word[0].toUpperCase() + word.slice(1));
    if (tags.size >= 8) break;
  }
  return [...tags].slice(0, 8);
}

function toDate(value) {
  if (!value) return undefined;
  const text = String(value).trim();
  // Contracts Finder publishes plain dates; OCDS uses full timestamps.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:00.000Z` : text;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function money(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/* ------------------------------------------------------------ source adapters */

/**
 * UK Contracts Finder. Endpoint and payload shape confirmed against working
 * clients (Open Data Institute, maxharlow/scrape-contracts-finder).
 */
async function fetchContractsFinder() {
  const body = {
    searchCriteria: {
      types: ["Contract"],
      statuses: INCLUDE_CLOSED ? ["Open", "Closed", "Awarded"] : ["Open"],
      keyword: KEYWORD || null,
      queryString: null,
      regions: null,
      postcode: null,
      radius: 0.0,
      valueFrom: null,
      valueTo: null,
      publishedFrom: null,
      publishedTo: null,
      deadlineFrom: null,
      deadlineTo: null,
      approachMarketFrom: null,
      approachMarketTo: null,
      awardedFrom: null,
      awardedTo: null,
      isSubcontract: null,
      suitableForSme: null,
      suitableForVco: null,
      cpvCodes: null,
    },
    size: Math.min(PAGE_SIZE, Math.max(LIMIT, 1)),
  };

  const response = await fetch(CONTRACTS_FINDER_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Contracts Finder returned HTTP ${response.status} ${response.statusText}`
    );
  }

  const payload = await response.json();
  const notices = payload.noticeList ?? payload.notices ?? payload.results;
  if (!Array.isArray(notices)) {
    throw new Error(
      `Unexpected Contracts Finder payload — top-level keys were: ${Object.keys(payload).join(", ")}`
    );
  }
  console.log(
    `  Contracts Finder: ${payload.hitCount ?? notices.length} matching notices, ${notices.length} fetched`
  );
  return notices.map(mapContractsFinderNotice);
}

function mapContractsFinderNotice(notice) {
  const cpvCodes = (notice.cpvCodes ?? []).map(String);
  const title = clean(notice.title, 160);
  const description = clean(notice.description, 8000);
  const organisation = clean(notice.organisationName, 120) || "Unknown buyer";

  const valueHigh = money(notice.valueHigh);
  const valueLow = money(notice.valueLow);
  const budgetMax = valueHigh ?? valueLow;
  const budgetTarget = Math.min(valueLow ?? Math.round((budgetMax ?? 0) * 0.85), budgetMax ?? 0);

  const deadline = toDate(notice.deadlineDate);
  const detailId = notice.item?.id ?? notice.id ?? notice.identifier;
  const url = notice.id
    ? `https://www.contractsfinder.service.gov.uk/notice/${notice.id}`
    : `https://www.contractsfinder.service.gov.uk/Notice/${detailId}`;

  return {
    title,
    summary: description.slice(0, 240) || title,
    description: description || title,
    category: categoryFor(cpvCodes, title, description),
    buyerName: organisation,
    budgetMax,
    budgetTarget,
    deadline,
    closesAt: deadline,
    location: clean(notice.region ?? notice.location ?? "", 120) || "United Kingdom",
    tags: tagsFor(cpvCodes, title, description),
    mustHaves: [],
    source: {
      name: "UK Contracts Finder",
      url,
      ref: String(notice.identifier ?? notice.id ?? detailId ?? title),
      importedAt: new Date().toISOString(),
    },
  };
}

/** Open Contracting Data Standard — releases or records, from a file or URL. */
async function fetchOcds() {
  let payload;
  if (has("url")) {
    const response = await fetch(get("url"));
    if (!response.ok) {
      throw new Error(`OCDS source returned HTTP ${response.status}`);
    }
    payload = await response.json();
  } else if (has("file")) {
    payload = JSON.parse(await readFile(path.resolve(get("file")), "utf8"));
  } else {
    throw new Error("--source=ocds needs --file=<path> or --url=<url>");
  }

  const releases = payload.releases ?? payload.records ?? (Array.isArray(payload) ? payload : []);
  if (!Array.isArray(releases) || releases.length === 0) {
    throw new Error(
      `No releases found — top-level keys were: ${Object.keys(payload).join(", ")}`
    );
  }
  console.log(`  OCDS: ${releases.length} releases`);
  return releases.map((release) => mapOcdsRelease(release.release ?? release.compiledRelease ?? release));
}

function mapOcdsRelease(release) {
  const tender = release.tender ?? {};
  const title = clean(tender.title ?? release.title, 160);
  const description = clean(tender.description ?? release.description, 8000);
  const cpv = (tender.items ?? [])
    .map((item) => item.classification?.id)
    .concat(tender.classification?.id)
    .filter(Boolean)
    .map(String);

  const amount = money(tender.value?.amount ?? tender.minValue?.amount);
  const budgetMax = amount;
  const deadline =
    toDate(tender.tenderPeriod?.endDate) ??
    toDate(tender.deadline) ??
    toDate(release.tenderPeriod?.endDate);

  return {
    title,
    summary: description.slice(0, 240) || title,
    description: description || title,
    category: categoryFor(cpv, title, description),
    buyerName: clean(release.buyer?.name ?? release.parties?.[0]?.name, 120) || "Unknown buyer",
    budgetMax,
    budgetTarget: budgetMax ? Math.round(budgetMax * 0.85) : undefined,
    deadline,
    closesAt: deadline,
    location: clean(release.buyer?.address?.countryName ?? tender.location ?? "", 120) || "United Kingdom",
    tags: tagsFor(cpv, title, description),
    mustHaves: [],
    source: {
      name: clean(release.buyer?.name ? "OCDS feed" : "OCDS feed", 80),
      url: clean(tender.documents?.[0]?.url ?? release.uri ?? "", 500) || "https://standard.open-contracting.org/",
      ref: String(release.ocid ?? release.id ?? title),
      importedAt: new Date().toISOString(),
    },
  };
}

/** Bundled fixture — used to verify the mapper without network access. */
async function fetchSample() {
  const file = path.join(HERE, "fixtures", "contracts-finder.sample.json");
  const payload = JSON.parse(await readFile(file, "utf8"));
  const notices = payload.noticeList ?? [];
  console.log(`  Fixture: ${notices.length} notices from scripts/fixtures (NOT live data)`);
  return notices.map(mapContractsFinderNotice);
}

/* ------------------------------------------------------------------ pipeline */

function validate(record, index) {
  const problems = [];
  const need = (value, label) => {
    if (value === undefined || value === null || value === "") problems.push(label);
  };
  need(record.title, "title");
  need(record.description, "description");
  need(record.buyerName, "buyer");
  need(record.budgetMax, "budgetMax");
  need(record.budgetTarget, "budgetTarget");
  need(record.deadline, "deadline");
  if (record.budgetTarget && record.budgetMax && record.budgetTarget > record.budgetMax) {
    problems.push("target>ceiling");
  }
  if (record.deadline && record.deadline.getTime() < Date.now() && !INCLUDE_CLOSED) {
    problems.push("deadline in the past");
  }
  if (record.budgetMax && record.budgetMax < MIN_VALUE) problems.push("below --min-value");
  if (!record.tags?.length) problems.push("no tags");
  return problems.length ? { index, title: record.title || "(untitled)", problems } : null;
}

async function main() {
  console.log(`\nXMARKET import — source: ${SOURCE}${DRY_RUN ? " (dry run)" : ""}\n`);

  const mapped =
    SOURCE === "contracts-finder"
      ? await fetchContractsFinder()
      : SOURCE === "ocds"
        ? await fetchOcds()
        : SOURCE === "sample"
          ? await fetchSample()
          : (() => {
              throw new Error(`Unknown --source=${SOURCE}. Use contracts-finder, ocds or sample.`);
            })();

  const usable = [];
  const rejected = [];
  for (const [index, record] of mapped.slice(0, LIMIT).entries()) {
    const problem = validate(record, index);
    if (problem) rejected.push(problem);
    else
      usable.push({
        ...record,
        deadline: record.deadline.toISOString(),
        closesAt: (record.closesAt ?? record.deadline).toISOString(),
      });
  }

  console.log(
    `\n  mapped ${mapped.length} → usable ${usable.length}, rejected ${rejected.length}`
  );
  for (const row of rejected.slice(0, 8)) {
    console.log(`    skip  ${row.title.slice(0, 58)}  (${row.problems.join(", ")})`);
  }
  if (rejected.length > 8) console.log(`    … and ${rejected.length - 8} more`);

  if (usable.length === 0) {
    console.log("\n  Nothing to import. Loosen --limit / --min-value, or use --include-closed.\n");
    return;
  }

  const categories = usable.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  categories: ${JSON.stringify(categories)}`);

  const preview = usable[0];
  console.log(
    `\n  example: ${preview.title.slice(0, 70)}\n    ${preview.buyerName} · ${preview.category} · ` +
      `$${preview.budgetMax.toLocaleString()} ceiling · ${preview.deadline.slice(0, 10)} · ` +
      `tags: ${preview.tags.slice(0, 4).join(", ")}`
  );

  if (DRY_RUN) {
    console.log("\n  Dry run — nothing written.\n");
    return;
  }

  const response = await fetch(`${API}/api/admin/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requirements: usable, dryRun: false }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(
      `Import rejected by ${API}: ${message}\n` +
        (response.status === 409
          ? "  Production requires XMARKET_ALLOW_IMPORT=true.\n"
          : "")
    );
  }

  const r = payload.data;
  console.log(
    `\n  imported ${r.imported} of ${r.total} · ${r.buyersCreated} new buyer organisations · ${r.skipped.length} skipped`
  );
  for (const row of r.skipped.slice(0, 5)) {
    console.log(`    skip  ${row.title.slice(0, 58)}  (${row.reason})`);
  }
  console.log(`\n  View them: ${API}/market?category=all\n`);
}

main().catch((error) => {
  console.error(`\n  Import failed: ${error.message}\n`);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(error.message)) {
    console.error(
      "  Network or server problem. Check that `npm run dev` is running and that\n" +
        "  this machine can reach the source (some sandboxes and CI runners block it).\n"
    );
  }
  process.exitCode = 1;
});
