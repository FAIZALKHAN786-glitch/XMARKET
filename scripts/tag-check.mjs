#!/usr/bin/env node
/**
 * Tag-matching check. Run: npm run tags:check
 *
 * Tag coverage is the heaviest single signal in both scorers, so a silent
 * mismatch costs a provider their ranking. These cases pin the behaviour of
 * lib/tags.ts — including the ones that must NOT match, since a false positive
 * inflates a score a buyer acts on.
 */
import { tagKey, tagCovered, coveredTags, tagCoverage } from "../lib/tags.ts";

const cases = [
  ["Anodising", ["anodized"], true, "british spelling, gerund vs participle"],
  ["Anodising", ["Type II anodising"], false, "a different phrase must not match"],
  ["Aluminium 6061", ["aluminum 6061"], true, "aluminium/aluminum"],
  ["injection moulding", ["Injection Molding"], true, "mould/mold plus case"],
  ["5-axis CNC", ["5 axis cnc"], true, "hyphen plus case"],
  ["PPAP", ["ppap"], true, "acronym case"],
  ["ISO 9001", ["iso 9001"], true, "standard, case only"],
  ["galvanising", ["GALVANIZED"], true, "same process, gerund vs participle"],
  ["CNC machining", ["sand casting"], false, "unrelated must not match"],
  ["unit price", ["units price"], true, "light plural strip"],
  ["class A finish", ["clas A finish"], false, "must not stem 'class'"],
  ["cold chain", ["Cold-Chain"], true, "hyphen plus case"],
];

let fail = 0;
for (const [req, covers, want, why] of cases) {
  const got = tagCovered(req, covers);
  if (got !== want) fail++;
  console.log(`  ${got === want ? "PASS" : "FAIL"}  ${req} ~ ${JSON.stringify(covers)} -> ${got}  # ${why}`);
}

const cov = tagCoverage(["Anodising", "PPAP", "Aluminium 6061"], ["anodized", "ppap"]);
const covOk = Math.abs(cov - 2 / 3) < 1e-9;
if (!covOk) fail++;
console.log(`  ${covOk ? "PASS" : "FAIL"}  coverage 2 of 3 = ${cov.toFixed(4)}`);

const emptyOk = tagCoverage([], ["x"], 0.7) === 0.7;
if (!emptyOk) fail++;
console.log(`  ${emptyOk ? "PASS" : "FAIL"}  no tags -> neutral 0.7`);

const wording = JSON.stringify(coveredTags(["Anodising", "PPAP"], ["anodized"]));
const wordingOk = wording === '["Anodising"]';
if (!wordingOk) fail++;
console.log(`  ${wordingOk ? "PASS" : "FAIL"}  buyer's own wording preserved: ${wording}`);

const idem = tagKey(tagKey("Aluminium 6061")) === tagKey("Aluminium 6061");
if (!idem) fail++;
console.log(`  ${idem ? "PASS" : "FAIL"}  tagKey is idempotent`);

console.log(fail ? `\n  ${fail} FAILED\n` : `\n  all passed\n`);
process.exit(fail ? 1 : 0);
