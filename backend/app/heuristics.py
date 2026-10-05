"""Deterministic fallbacks — the Python twins of the heuristics in lib/server/ai.ts.

The fallback is not a placeholder: when no API key is present the product
still produces something useful, and every response says which one answered.

Tag canonicalisation is ported verbatim from lib/tags.ts — coverage is the
heaviest single signal in the semantic fit, so a wrong match here silently
inflates a score a buyer acts on.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

# --------------------------------------------------------------- tag keys

SYNONYMS: dict[str, str] = {
    "aluminium": "aluminum",
    "mould": "mold",
    "moulding": "molding",
    "defence": "defense",
    "organisation": "organization",
    "galvanising": "galvanizing",
    "passivation": "passivation",
}


def tag_key(tag: str) -> str:
    key = tag.lower()
    key = unicodedata.normalize("NFKD", key)
    key = re.sub(r"[\u0300-\u036f]", "", key)
    key = re.sub(r"[_/]+", " ", key)
    key = re.sub(r"[^a-z0-9+#.\s-]", " ", key)
    key = key.replace("-", " ")
    key = re.sub(r"\s+", " ", key).strip()

    def normalise_word(w: str) -> str:
        w = re.sub(r"isation$", "ization", w)
        w = re.sub(r"ising$", "izing", w)
        w = re.sub(r"ised$", "ized", w)
        w = re.sub(r"ise$", "ize", w)
        w = re.sub(r"izing$", "ize", w)
        w = re.sub(r"ized$", "ize", w)
        w = SYNONYMS.get(w, w)
        if len(w) > 3 and w.endswith("s") and not w.endswith("ss") and not w.endswith("us"):
            w = w[:-1]
        return w

    return " ".join(normalise_word(w) for w in key.split(" "))


def tag_covered(required: str, covers: list[str]) -> bool:
    key = tag_key(required)
    if not key:
        return False
    return any(tag_key(c) == key for c in covers)


def covered_tags(required: list[str], covers: list[str]) -> list[str]:
    return [r for r in required if tag_covered(r, covers)]


def tag_coverage(required: list[str], covers: list[str], when_empty: float = 0.0) -> float:
    if not required:
        return when_empty
    return len(covered_tags(required, covers)) / len(required)


# ------------------------------------------------------- money & rate text

MONEY_UNITS: dict[str, float] = {
    "k": 1_000,
    "thousand": 1_000,
    "m": 1_000_000,
    "mn": 1_000_000,
    "million": 1_000_000,
}

MONEY_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*(k|m|mn|million|thousand)?(?![a-z\d])", re.IGNORECASE)
MONEY_WORD_RE = re.compile(
    r"(?:budget|cost|price|spend|under|max(?:imum)?|cap|ceiling|around)\D{0,12}"
    r"([\d,]+(?:\.\d+)?)\s*(k|m|mn|million|thousand)?(?![a-z\d])",
    re.IGNORECASE,
)

RATE_LANGUAGE = re.compile(
    r"\b(per|a|an|each|every|twice a|once a|daily|weekly|fortnightly|monthly|"
    r"quarterly|annually|hourly)\s+(week|day|month|year|quarter|hour|shift|"
    r"pallet|trip|drop|mile|km|unit|item|piece|head|seat|visit|call[- ]?out)\b"
    r"|\b(weekly|daily|monthly|hourly|per[- ]unit|per[- ]week|per[- ]month|"
    r"per[- ]pallet|per[- ]trip)\b",
    re.IGNORECASE,
)


def extract_money(brief: str) -> list[int]:
    found: list[int] = []
    for match in MONEY_RE.finditer(brief):
        raw = _to_number(match.group(1))
        if raw is None:
            continue
        unit = (match.group(2) or "").lower()
        found.append(int(raw * MONEY_UNITS[unit]) if unit else int(raw))
    if not found:
        for match in MONEY_WORD_RE.finditer(brief):
            raw = _to_number(match.group(1))
            if raw is None:
                continue
            unit = (match.group(2) or "").lower()
            found.append(int(raw * MONEY_UNITS[unit]) if unit else int(raw))
    # Sub-$500 figures in a procurement brief are unit prices or noise.
    return [n for n in found if n >= 500]


def _to_number(raw: str) -> float | None:
    try:
        value = float(raw.replace(",", ""))
    except ValueError:
        return None
    return value if value > 0 else None


def rate_language_in(brief: str) -> str | None:
    match = RATE_LANGUAGE.search(brief)
    return match.group(0) if match else None


# -------------------------------------------------------- category & tags

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "manufacturing": ["cnc", "machin", "mould", "mold", "tooling", "sheet metal", "casting", "fabricat", "weld", "aluminium", "aluminum", "injection"],
    "software": ["software", "app", "web", "api", "dashboard", "platform", "frontend", "backend", "database", "migration", "saas", "next.js", "react"],
    "logistics": ["freight", "haulage", "shipping", "cold chain", "ltl", "pallet", "warehous", "logistics", "customs", "truck", "transport"],
    "design": ["design", "brand", "packaging", "identity", "logo", "illustrat", "ux", "ui", "motion", "art direction"],
    "construction": ["fit-out", "fitout", "construction", "mep", "cleanroom", "mezzanine", "permit", "hvac", "civil", "electrical install"],
    "electronics": ["pcb", "smt", "firmware", "embedded", "circuit", "sensor", "iot", "microcontroller", "stm32", "esp32", "emc"],
}

TAG_DICTIONARY = [
    "5-axis CNC", "CNC", "Aluminium 6061", "Anodising", "Injection moulding", "Sheet metal",
    "Next.js", "React", "TypeScript", "Postgres", "REST API", "Design system", "Data viz",
    "Accessibility", "ETL", "Data reconciliation", "Legacy migration", "Node.js",
    "Cold chain", "LTL", "Temperature logging", "FDA FSMA", "Dedicated lane", "Last mile",
    "Packaging", "Dielines", "Sustainability", "Retail", "Brand system", "Identity",
    "Fit-out", "MEP", "Permits", "Phased works", "ISO 8 cleanroom",
    "SMT", "0201", "AOI", "Conformal coating", "Traceability", "PCB layout", "Firmware",
    "ISO 9001", "PPAP", "EMC testing", "FCC pre-scan", "Prototyping", "Tooling",
]

FALLBACK_TAGS: dict[str, list[str]] = {
    "manufacturing": ["CNC", "Tooling", "ISO 9001"],
    "software": ["TypeScript", "REST API", "Design system"],
    "logistics": ["LTL", "Last mile", "Dedicated lane"],
    "design": ["Identity", "Brand system", "Packaging"],
    "construction": ["Fit-out", "MEP", "Permits"],
    "electronics": ["SMT", "AOI", "Firmware"],
}


def tag_matches(lower_brief: str, tag: str) -> bool:
    lower = tag.lower()
    if lower in lower_brief:
        return True
    words = [w for w in re.split(r"[\s-]+", lower) if len(w) >= 5]
    if not words:
        return False
    return all(w[: max(5, len(w) - 3)] in lower_brief for w in words)


# ------------------------------------------------------------ sanity check

ARITHMETIC_EVIDENCE = re.compile(
    r"[×xX*]\s*[\d$]|\$\s?[\d,]+\s*[×xX*]|\bmultiplied\b|\btotal for the\b", re.IGNORECASE
)


def sanity_check(draft: dict[str, Any], brief: str, min_budget_floor: int) -> dict[str, Any]:
    """Last line of defence on the parsed budget — model and heuristic output alike."""
    assumptions = list(draft.get("assumptions") or [])
    confidence = draft["confidence"]
    budget_max = draft["budgetMax"]
    budget_target = draft["budgetTarget"]

    # 1. An implausibly small total cannot be the value of a whole engagement.
    if 0 < budget_max < min_budget_floor:
        assumptions.append(
            f"The parsed budget (${budget_max:,}) looked like a unit price or a rate rather than a total, "
            f"so it was raised to a ${min_budget_floor:,} floor. Check this before publishing."
        )
        budget_max = min_budget_floor
        budget_target = min(budget_target, min_budget_floor)
        confidence = min(confidence, 0.4)

    # 2. The brief quotes a rate. Either the arithmetic is already spelled out
    #    in the assumptions, or the ceiling needs checking.
    rate = rate_language_in(brief)
    if rate:
        explained = any(ARITHMETIC_EVIDENCE.search(a) for a in assumptions)
        if not explained:
            assumptions.append(
                f'This brief quotes a rate ("{rate}"), so the ceiling above may be a rate rather than the total '
                "for the whole engagement. Check that it reflects the full term before publishing."
            )
            confidence = min(confidence, 0.6)

    if len(assumptions) == len(draft.get("assumptions") or []) and budget_max == draft["budgetMax"]:
        return draft
    return {**draft, "budgetMax": budget_max, "budgetTarget": budget_target, "confidence": confidence, "assumptions": assumptions}


# ---------------------------------------------------------------- parsing

def heuristic_parse(brief: str, defaults: dict | None = None) -> dict[str, Any]:
    defaults = defaults or {}
    lower = brief.lower()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", brief) if s.strip()]

    money = extract_money(brief)
    budget_max = max(money) if money else 50_000
    budget_target = min(money) if money else round(budget_max * 0.82)

    weeks = re.search(r"(\d+)\s*(?:\+)?\s*weeks?", lower)
    days = re.search(r"(\d+)\s*days?", lower)
    months = re.search(r"(\d+)\s*months?", lower)
    deadline_in_days = 60
    if weeks:
        deadline_in_days = int(weeks.group(1)) * 7
    elif months:
        deadline_in_days = int(months.group(1)) * 30
    elif days:
        deadline_in_days = int(days.group(1))
    elif re.search(r"urgent|asap|immediately", lower):
        deadline_in_days = 14

    category = defaults.get("category") or "software"
    best_hits = 0
    for cid, words in CATEGORY_KEYWORDS.items():
        hits = sum(1 for w in words if w in lower)
        if hits > best_hits:
            best_hits = hits
            category = cid

    tags = [t for t in TAG_DICTIONARY if tag_matches(lower, t)][:8]
    inferred_tags = (tags if len(tags) >= 2 else tags + FALLBACK_TAGS.get(category, ["Prototyping"]))[:4]

    must_haves = [
        re.sub(r"\s+", " ", s).strip()[:150]
        for s in sentences
        if re.search(r"\b(must|required|need(?:ed)?|mandatory|no more than|within|certified)\b", s, re.IGNORECASE)
    ][:6]

    location = defaults.get("location")
    if not location:
        if re.search(r"remote|anywhere|worldwide", brief, re.IGNORECASE):
            location = "Remote"
        else:
            loc_match = re.search(r"\b(?:in|near|at)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?(?:,\s?[A-Z]{2})?)", brief)
            location = loc_match.group(1) if loc_match else "Remote"

    title_source = sentences[0] if sentences else brief
    title = re.sub(r"\s+", " ", title_source).strip()[:138]

    score_terms = 0.18 + best_hits * 0.08 + len(tags) * 0.05 + (0.12 if money else 0.0)

    return {
        "title": title if len(title) >= 8 else f"{title} — requirement"[:138],
        "summary": re.sub(r"\s+", " ", sentences[1] if len(sentences) > 1 else (sentences[0] if sentences else brief)).strip()[:238],
        "description": brief.strip()[:6000],
        "category": category,
        "budgetMax": budget_max,
        "budgetTarget": min(budget_target, budget_max),
        "deadlineInDays": max(3, min(730, deadline_in_days)),
        "closingInDays": 14,
        "location": location,
        "tags": inferred_tags,
        "mustHaves": must_haves,
        "confidence": min(0.62, score_terms),
        "assumptions": [
            (
                f"Budgets read from the brief: {', '.join('$' + f'{m:,}' for m in money)}."
                if money
                else f"No budget stated — assumed a ${budget_max:,} ceiling."
            ),
            f"Delivery assumed at {deadline_in_days} days from award.",
            f"Category inferred as {category} from keyword frequency.",
        ],
    }


# --------------------------------------------------------- semantic scoring

STOP = set(
    "the a an and or of to in for with on at by is are be we our you your it its that this "
    "from will would can could as not no if then than so we'd we'll".split()
)


def _tokens(text: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9\s.+#/-]", " ", text.lower())
    return [t for t in cleaned.split() if len(t) > 2 and t not in STOP]


SPECIFICITY_PATTERNS = [
    re.compile(r"\b\d+(?:\.\d+)?\s?(mm|µm|um|kg|units?|days?|weeks?|hours?|%)", re.IGNORECASE),
    re.compile(r"\b(ISO|IPC|ANSI|ASTM|FDA|FCC|CE|UL)\s?\d*", re.IGNORECASE),
    re.compile(r"\b(milestone|fixture|stencil|fixture plan|tolerance|report|audit|calibrat)", re.IGNORECASE),
]


def heuristic_semantic_fit(requirement: dict, bid: dict, provider: dict | None) -> dict[str, Any]:
    req_tokens = set(
        _tokens(
            f'{requirement.get("title", "")} {requirement.get("description", "")} '
            f'{" ".join(requirement.get("mustHaves") or [])}'
        )
    )
    pitch_tokens = set(_tokens(bid.get("pitch", "")))
    overlap = sum(1 for t in pitch_tokens if t in req_tokens)
    coverage = min(1, overlap / min(len(req_tokens), 30)) if req_tokens else 0

    tag_cov = tag_coverage(requirement.get("tags") or [], bid.get("coversTags") or [])
    specificity = sum(1 for p in SPECIFICITY_PATTERNS if p.search(bid.get("pitch", ""))) / 3
    length_signal = min(1, len(bid.get("pitch", "").split()) / 90)

    gaps = [f'Does not address “{t}”.' for t in (requirement.get("tags") or []) if not tag_covered(t, bid.get("coversTags") or [])]

    raw = coverage * 22 + tag_cov * 40 + specificity * 22 + length_signal * 16
    score = round(max(5, min(97, raw)))
    addressed = covered_tags(requirement.get("tags") or [], bid.get("coversTags") or [])

    if score >= 78:
        verdict = f"Engages with {len(addressed)}/{len(requirement.get('tags') or [])} scored requirements and reads as specific."
    elif score >= 60:
        unaddressed = len(gaps)
        verdict = f"Covers the basics but leaves {unaddressed} requirement{'s' if unaddressed != 1 else ''} unaddressed."
    else:
        verdict = "Thin against this brief — the pitch is generic for the work described."

    return {
        "score": score,
        "verdict": verdict,
        "addressed": [f"Explicitly covers {t}." for t in addressed][:6],
        "gaps": gaps[:6],
        "confidence": min(0.7, 0.25 + coverage + tag_cov * 0.3),
    }


# ------------------------------------------------------------- bid drafting

def heuristic_draft(requirement: dict, provider: dict, delivery_days: int) -> dict[str, Any]:
    tags = requirement.get("tags") or []
    skills = provider.get("skills") or []
    supported = [
        t for t in tags
        if any(t.lower() in s.lower() or s.lower() in t.lower() for s in skills)
        or (requirement.get("category") in (provider.get("categories") or []))
    ]
    covers = supported if supported else tags[:3]

    split = [
        {"label": "Kick-off, scope confirmation and plan", "days": max(3, round(delivery_days * 0.15))},
        {"label": "Main delivery block", "days": max(7, round(delivery_days * 0.7))},
        {"label": "Review, acceptance and handover", "days": delivery_days},
    ]
    split = [m for i, m in enumerate(split) if i == 0 or m["days"] > split[i - 1]["days"]]

    musts = "; ".join((requirement.get("mustHaves") or [])[:3]) or "confirmed at kick-off"
    name = provider.get("name", "We")
    pitch = (
        f'{name} can take this on. {provider.get("tagline", "")} '
        f'For “{requirement.get("title", "")}” we would work to your stated must-haves — {musts} — '
        "and flag any deviation in writing before it affects the schedule.\n\n"
        f'Our track record: {provider.get("completedJobs", 0)} completed jobs, '
        f'{provider.get("onTimeRate", 0)}% delivered on time, {provider.get("rating", 0):.1f}★ across '
        f'{provider.get("reviews", 0)} reviews. We would schedule the work to land inside your window '
        "with buffer rather than promising the theoretical minimum.\n\n"
        "On award we need the requirement inputs confirm, a named contact for decisions, and any "
        "compliance documentation you require. We will confirm those within two business days."
    )

    unscored = len(tags) - len(supported)
    return {
        "pitch": pitch,
        "milestones": split,
        "coversTags": covers[:8],
        "risks": [
            (
                f"{unscored} scored tag(s) are outside the profile — confirm before claiming them."
                if unscored > 0
                else "No capability gaps detected against the scored tags."
            ),
            "Delivery assumes inputs are supplied on time; late inputs shift the schedule.",
        ],
    }


# ---------------------------------------------------------- comparison read

def heuristic_summary(requirement: dict, ranked: list[dict]) -> dict[str, Any]:
    """`ranked` rows are the compare endpoint's rows: {bid, provider?, score}."""
    if not ranked:
        return {
            "headline": "No offers to compare yet",
            "recommendation": "Post a requirement to start receiving scored offers.",
            "tradeoffs": [],
            "watchFor": [],
            "confidence": 0.35,
        }

    best = ranked[0]
    cheapest = min(ranked, key=lambda r: r["bid"]["price"])
    fastest = min(ranked, key=lambda r: r["bid"]["deliveryDays"])
    spread = max(r["bid"]["price"] for r in ranked) - min(r["bid"]["price"] for r in ranked)
    cheapest_is_best = cheapest["bid"]["id"] == best["bid"]["id"]
    fastest_is_best = fastest["bid"]["id"] == best["bid"]["id"]

    def factor(row: dict, key: str) -> dict | None:
        return next((f for f in row["score"].get("factors", []) if f.get("key") == key), None)

    best_provider_name = (best.get("provider") or {}).get("name")
    recommendation_extra = (
        "It is also the cheapest offer, so price and fit agree."
        if cheapest_is_best
        else (
            f'The cheapest offer is {(cheapest.get("provider") or {}).get("name")} at '
            f'${cheapest["bid"]["price"]:,}, ${best["bid"]["price"] - cheapest["bid"]["price"]:,} more for the '
            "leading bid — check that the difference is covered by the stronger factors."
        )
    )

    budget_target = requirement.get("budgetTarget", 0)
    return {
        "headline": (
            f'{best_provider_name} leads on compatibility at {best["score"]["total"]}/100 '
            f'with a ${spread:,} spread across the shortlist'
        ),
        "recommendation": (
            f'The engine ranks {best_provider_name} first ({best["score"]["grade"].lower()} fit): '
            f'${best["bid"]["price"]:,} delivered in {best["bid"]["deliveryDays"]} days, against a '
            f'${requirement.get("budgetMax", 0):,} ceiling. {recommendation_extra}'
        ),
        "tradeoffs": [
            {
                "providerId": row["bid"]["providerId"],
                "strength": (
                    sorted(row["score"].get("factors", []), key=lambda f: -f.get("score", 0))[0].get("detail")
                    if row["score"].get("factors")
                    else "Balanced across factors."
                ),
                "risk": (
                    (row["score"].get("risks") or [""])[0]
                    or (
                        f"Priced above the ${budget_target:,} target."
                        if row["bid"]["price"] > budget_target
                        else "No significant risk flagged by the engine."
                    )
                ),
            }
            for row in ranked[:4]
        ],
        "watchFor": [
            (
                "The fastest offer is also the strongest — timeline risk is low."
                if fastest_is_best
                else (
                    f'Fastest delivery is {fastest["bid"]["deliveryDays"]} days from '
                    f'{(fastest.get("provider") or {}).get("name")}; confirm that schedule is committed, '
                    "not aspirational."
                )
            ),
            f"Budget scoring anchors on the ${budget_target:,} target, so offers above it lose points "
            "even when they sit under the ceiling.",
            *((best["score"].get("risks") or [])[:1]),
        ],
        "confidence": min(0.75, 0.35 + len(ranked) * 0.08),
    }
