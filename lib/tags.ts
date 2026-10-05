/**
 * Tag matching.
 *
 * Tag coverage is the single heaviest signal in both scorers — 0.44 of the
 * deterministic relevance score and 40 of the 100 points in the heuristic
 * semantic fit — but it used to be an exact string comparison. A provider who
 * genuinely does the work but writes "anodized" where the buyer wrote
 * "Anodising" scored as though they had ignored the requirement entirely.
 *
 * So tags are canonicalised before they are compared. The rules are
 * deliberately conservative: case, spacing, hyphenation, a light plural strip,
 * and a small hand-written synonym table for the spellings this domain
 * actually varies on. Nothing fuzzy, no edit distance — a wrong match is worse
 * than a missed one, because it silently inflates a score a buyer acts on.
 */

/** Spellings that mean the same thing in procurement text. */
const SYNONYMS: Record<string, string> = {
  aluminium: "aluminum",
  mould: "mold",
  moulding: "molding",
  defence: "defense",
  organisation: "organization",
  galvanising: "galvanizing",
  passivation: "passivation",
};

/** Canonicalise one tag for comparison. Idempotent. */
export function tagKey(tag: string): string {
  let key = tag
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // British/US spelling, applied per word so "anodised finish" and
  // "anodized finish" land on the same key.
  key = key
    .split(" ")
    .map((word) => {
      let w = word
        .replace(/isation$/, "ization")
        .replace(/ising$/, "izing")
        .replace(/ised$/, "ized")
        .replace(/ise$/, "ize")
        // Collapse the verb forms onto one stem, so "anodising", "anodized"
        // and "anodize" all land on "anodize". Without this the gerund and
        // the participle of the same process still missed each other.
        .replace(/izing$/, "ize")
        .replace(/ized$/, "ize");
      w = SYNONYMS[w] ?? w;
      // Light plural strip. "units" -> "unit", but never touch "class" or "ss".
      if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) {
        w = w.slice(0, -1);
      }
      return w;
    })
    .join(" ");

  return key;
}

/** True when `covers` contains something that matches `required`. */
export function tagCovered(required: string, covers: string[]): boolean {
  const key = tagKey(required);
  if (!key) return false;
  return covers.some((c) => tagKey(c) === key);
}

/**
 * The subset of `required` that `covers` actually answers, in the buyer's own
 * wording so it can be shown back to them unchanged.
 */
export function coveredTags(required: string[], covers: string[]): string[] {
  return required.filter((r) => tagCovered(r, covers));
}

/** Coverage as 0..1, or the neutral value when the requirement has no tags. */
export function tagCoverage(
  required: string[],
  covers: string[],
  whenEmpty = 0
): number {
  if (required.length === 0) return whenEmpty;
  return coveredTags(required, covers).length / required.length;
}
