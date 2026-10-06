"""AI capabilities — the Python twins of the features in lib/server/ai.ts.

Each capability is one prompt plus one deterministic fallback, and every
response carries `meta` saying which one answered (llm vs heuristic, cached,
latency) — same contract as the Next.js `/api/ai/*` routes.

Context that lives in the marketplace store (ranked offers for the summary,
buyer-owned requirements and offers, or seller-owned bids plus public open
opportunities for the copilot) is fetched from the Next.js data endpoints over
HTTP. Those are deterministic reads — no LLM — so the ranking engine keeps a
single source of truth in TypeScript.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any
from urllib.parse import quote

import httpx

from . import heuristics, llm, schemas
from .config import Config
from .envelope import ApiError

HEURISTIC_MODEL = "xmarket-heuristic-v1"


def heuristic_meta(started: float, note: str) -> dict[str, Any]:
    return {
        "provider": "offline",
        "model": HEURISTIC_MODEL,
        "mode": "heuristic",
        "cached": False,
        "latencyMs": int((time.time() - started) * 1000),
        "note": note,
    }


def meta_from(result: llm.LlmResult) -> dict[str, Any]:
    return {
        "provider": result.provider,
        "model": result.model,
        "mode": "llm",
        "cached": result.cached,
        "latencyMs": result.latency_ms,
    }


async def record_ai_event(cfg: Config, capability: str, meta: dict[str, Any]) -> None:
    """Audit-log mirror of the TS app's withFallback recording.

    Goes through the Next.js internal writer — the Next process is the single
    writer of the marketplace store, and this keeps the activity feed and the
    AI status "recent" trace populated regardless of which process answered.
    Fire-and-forget: logging must never fail an AI response. The failed-LLM
    fallback path records no event, matching the TypeScript behaviour.
    """
    if meta.get("mode") == "llm":
        summary = f"{capability} answered by {meta['provider']} ({meta['model']})"
        event_meta: dict[str, Any] = {
            "mode": "llm",
            "cached": meta.get("cached"),
            "latencyMs": meta.get("latencyMs"),
        }
    else:
        summary = f"{capability} answered by the offline heuristic engine"
        event_meta = {"mode": "heuristic"}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                cfg.next_base_url + "/api/internal/record-event",
                json={
                    "type": "ai.invoked",
                    "actor": "system",
                    "summary": summary,
                    "meta": event_meta,
                },
                headers={"x-xmarket-internal-secret": cfg.internal_secret},
            )
    except Exception:  # noqa: BLE001 — audit logging is best-effort
        pass


async def next_data(cfg: Config, path: str) -> dict[str, Any]:
    """GET a deterministic data endpoint on the Next.js app."""
    url = cfg.next_base_url + path
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(url)
    except httpx.HTTPError as exc:
        raise ApiError("upstream", f"The app server is unreachable ({exc}).") from exc
    if res.status_code >= 300:
        raise ApiError("upstream", f"App server returned {res.status_code} for {path}.")
    payload = res.json()
    if not payload.get("ok"):
        raise ApiError("upstream", f"App server error: {payload.get('error', {}).get('message', path)}")
    return payload["data"]


# ============================================================================
# 1. Requirement parsing
# ============================================================================

CATEGORY_LABELS = ""  # filled from the app at call time (see parse_requirement)


async def parse_requirement(
    cfg: Config, brief: str, defaults: dict | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
    if not cfg.live:
        started = time.time()
        draft = heuristics.sanity_check(
            heuristics.heuristic_parse(brief, defaults), brief, cfg.min_budget_floor
        )
        meta = heuristic_meta(
            started, "Extracted with pattern matching — review the numbers before publishing."
        )
        await record_ai_event(cfg, "Requirement parsing", meta)
        return draft, meta

    try:
        category_labels = await _category_labels(cfg)
        result = await llm.chat(
            cfg,
            [
                {
                    "role": "system",
                    "content": llm.system_prompt(
                        "Convert a buyer's free-text brief into a structured procurement requirement.\n\n"
                        f"Available categories:\n{category_labels}\n\n"
                        "Return a JSON object with exactly these keys:\n"
                        '{"title": string (max 140),\n'
                        ' "summary": string (one sentence, max 240),\n'
                        ' "description": string (2-4 paragraphs, keep the buyer\'s specifics),\n'
                        ' "category": one of the category ids above,\n'
                        ' "budgetMax": integer USD (hard ceiling),\n'
                        ' "budgetTarget": integer USD (what they hope to pay, <= budgetMax),\n'
                        ' "deadlineInDays": integer days until delivery is needed,\n'
                        ' "closingInDays": integer days the bidding window stays open (default 14),\n'
                        ' "location": string,\n'
                        ' "tags": string[] (3-8 short spec keywords used to score providers),\n'
                        ' "mustHaves": string[] (0-6 hard requirements),\n'
                        ' "confidence": number 0-1,\n'
                        ' "assumptions": string[] (anything you had to infer)}\n\n'
                        "Budget rules:\n"
                        "- budgetMax is the TOTAL value of the whole engagement in USD, never a rate, a unit price or a per-period figure.\n"
                        "- If the brief quotes a unit price (per unit, each, per item) and a quantity, multiply them.\n"
                        "- If it quotes a recurring or period rate (per week, per month, per pallet, per trip, daily) and a term or frequency, multiply out to the whole term.\n"
                        '- State the arithmetic in assumptions, e.g. "$115 x 500 units = $57,500 ceiling" or "$2,400/week x 14 weeks = $33,600 ceiling".\n'
                        "- Never emit a unit price or a weekly rate as budgetMax. If you cannot derive the total, infer a defensible total for the whole engagement and say so.\n"
                        "- If no budget is stated, infer a defensible range for the work described and list it as an assumption."
                    ),
                },
                {"role": "user", "content": llm.untrusted("buyer brief", brief)},
            ],
            schema=schemas.ParsedRequirement,
            temperature=0.2,
        )
        value = result.value
        if value.get("category") not in schemas.CATEGORY_IDS:
            raise ApiError("unprocessable", "Model returned an unknown category.", value.get("category"))

        has_rate_language = bool(
            __import__("re").search(
                r"(?:\bper[\s-]+(?:hours?|hrs?|days?|weeks?|months?|units?|items?|pieces?)\b"
                r"|/\s*(?:h|hr|hrs|hour|hours|day|week|month|unit|item|piece)\b"
                r"|\b(?:hourly|daily|weekly|monthly|unit[\s-]+(?:cost|price|rate))\b)",
                brief,
                __import__("re").IGNORECASE,
            )
        )
        if has_rate_language and min(value["budgetMax"], value["budgetTarget"]) < 500:
            raise ApiError(
                "unprocessable", "Model returned a likely rate instead of a total project budget."
            )

        draft = heuristics.sanity_check(value, brief, cfg.min_budget_floor)
        meta = meta_from(result)
        await record_ai_event(cfg, "Requirement parsing", meta)
        return draft, meta
    except ApiError:
        started_fallback = time.time()
        draft = heuristics.sanity_check(
            heuristics.heuristic_parse(brief, defaults), brief, cfg.min_budget_floor
        )
        return draft, heuristic_meta(
            started_fallback,
            "Model call failed, heuristic answer shown. Extracted with pattern matching — review the numbers.",
        )


async def _category_labels(cfg: Config) -> str:
    data = await next_data(cfg, "/api/requirements")
    return "\n".join(c for c in data.get("meta", {}).get("categories", []))


# ============================================================================
# 2. Semantic fit
# ============================================================================

async def score_semantic_fit(
    cfg: Config, requirement: dict, bid: dict, provider: dict | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
    if not cfg.live:
        started = time.time()
        meta = heuristic_meta(started, "Scored by keyword coverage and specificity — no model was called.")
        await record_ai_event(cfg, "Semantic fit scoring", meta)
        return heuristics.heuristic_semantic_fit(requirement, bid, provider), meta

    try:
        supplier_record = (
            f'{provider.get("name")} — {provider.get("rating")}★ over {provider.get("reviews")} reviews, '
            f'{provider.get("onTimeRate")}% on time, {provider.get("completedJobs")} jobs, '
            f'verified: {provider.get("verified")}'
            if provider
            else "unknown"
        )
        result = await llm.chat(
            cfg,
            [
                {
                    "role": "system",
                    "content": llm.system_prompt(
                        "Judge how well a supplier's proposal answers a buyer's requirement.\n\n"
                        "Score 0-100 on substance only: does the pitch engage with the specific must-haves, "
                        "quantities, standards and risks named in the requirement? Ignore price — that is "
                        "scored separately. Reward concrete plans and named methods; penalise generic "
                        "marketing language.\n\n"
                        "Return:\n"
                        '{"score": integer 0-100,\n'
                        ' "verdict": string (max 160, one sentence a buyer can act on),\n'
                        ' "addressed": string[] (requirement points the pitch genuinely covers),\n'
                        ' "gaps": string[] (requirement points the pitch ignores or hand-waves),\n'
                        ' "confidence": number 0-1}'
                    ),
                },
                {
                    "role": "user",
                    "content": "\n\n".join(
                        [
                            llm.untrusted("requirement title", requirement.get("title", "")),
                            llm.untrusted("requirement detail", requirement.get("description", "")),
                            llm.untrusted("must-haves", "\n".join(requirement.get("mustHaves") or []) or "none"),
                            llm.untrusted("scored tags", ", ".join(requirement.get("tags") or [])),
                            llm.untrusted("proposal pitch", bid.get("pitch", "")),
                            llm.untrusted("tags the supplier claims", ", ".join(bid.get("coversTags") or [])),
                            llm.untrusted("supplier record", supplier_record),
                        ]
                    ),
                },
            ],
            schema=schemas.SemanticScore,
            temperature=0.1,
        )
        meta = meta_from(result)
        await record_ai_event(cfg, "Semantic fit scoring", meta)
        return result.value, meta
    except ApiError:
        started = time.time()
        return (
            heuristics.heuristic_semantic_fit(requirement, bid, provider),
            heuristic_meta(started, "Model call failed, heuristic answer shown. Keyword coverage and specificity."),
        )


# ============================================================================
# 3. Bid drafting
# ============================================================================

async def draft_bid(
    cfg: Config,
    requirement: dict,
    provider: dict,
    params: dict | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    params = params or {}
    delivery_days = params.get("deliveryDays") or 30

    if not cfg.live:
        started = time.time()
        meta = heuristic_meta(
            started, "Assembled from the supplier profile and requirement — edit before submitting."
        )
        await record_ai_event(cfg, "Bid drafting", meta)
        return heuristics.heuristic_draft(requirement, provider, delivery_days), meta

    try:
        offer_price = params.get("targetPrice") or requirement.get("budgetTarget", 0)
        result = await llm.chat(
            cfg,
            [
                {
                    "role": "system",
                    "content": llm.system_prompt(
                        "Draft a supplier proposal for a procurement requirement.\n\n"
                        "Write in first person plural, plainly and specifically. Reference the buyer's actual "
                        "must-haves and spec tags. Never invent certifications, past clients, machinery or "
                        "guarantees that are not in the supplier record. If the supplier record lacks "
                        "experience the requirement asks for, say what would be needed instead of claiming it.\n\n"
                        "Return:\n"
                        '{"pitch": string (3 short paragraphs, max 4000 chars),\n'
                        ' "milestones": [{"label": string, "days": integer days from award}] (2-6, strictly increasing),\n'
                        ' "coversTags": string[] (subset of the requirement\'s scored tags the supplier can support),\n'
                        ' "risks": string[] (honest caveats)}\n\n'
                        f"The final milestone must land on or before day {delivery_days}."
                    ),
                },
                {
                    "role": "user",
                    "content": "\n\n".join(
                        filter(
                            None,
                            [
                                llm.untrusted(
                                    "requirement",
                                    f'{requirement.get("title", "")}\n\n{requirement.get("summary", "")}\n\n{requirement.get("description", "")}',
                                ),
                                llm.untrusted("must-haves", "\n".join(requirement.get("mustHaves") or []) or "none stated"),
                                llm.untrusted("scored tags", ", ".join(requirement.get("tags") or [])),
                                llm.untrusted(
                                    "supplier profile",
                                    f'{provider.get("name")} — {provider.get("tagline")}. Skills: '
                                    f'{", ".join(provider.get("skills") or [])}. Categories: '
                                    f'{", ".join(provider.get("categories") or [])}. '
                                    f'{provider.get("rating")}★ over {provider.get("reviews")} reviews, '
                                    f'{provider.get("onTimeRate")}% on time, {provider.get("completedJobs")} jobs completed.',
                                ),
                                llm.untrusted(
                                    "commercial parameters",
                                    f"Offer price ${offer_price:,}; delivery in {delivery_days} days.",
                                ),
                                llm.untrusted("supplier notes", params["notes"]) if params.get("notes") else "",
                            ],
                        )
                    ),
                },
            ],
            schema=schemas.DraftBid,
            temperature=0.6,
        )
        meta = meta_from(result)
        await record_ai_event(cfg, "Bid drafting", meta)
        return result.value, meta
    except ApiError:
        started = time.time()
        return (
            heuristics.heuristic_draft(requirement, provider, delivery_days),
            heuristic_meta(
                started,
                "Model call failed, heuristic answer shown. Assembled from the supplier profile — edit before submitting.",
            ),
        )


# ============================================================================
# 4. Comparison summary
# ============================================================================

async def summarize_comparison(
    cfg: Config,
    requirement: dict,
    weights: dict,
    focus: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any], int]:
    """`ranked` is pulled from the app's compare endpoint (deterministic).

    Returns (summary, meta, offer_count) — offer_count is the total number of
    ranked offers, mirroring the app's `bids.length` in the TS route.
    """
    from urllib.parse import urlencode

    params: dict[str, Any] = {}
    if "budget" in weights:
        params["wBudget"] = weights["budget"]
    if "timeline" in weights:
        params["wTimeline"] = weights["timeline"]
    if "relevance" in weights:
        params["wRelevance"] = weights["relevance"]
    qs = urlencode(params)
    compare = await next_data(
        cfg, f"/api/requirements/{requirement['id']}/compare" + (f"?{qs}" if qs else "")
    )
    ranked = compare.get("ranked", [])
    top = ranked[:4]
    if not top:
        raise ApiError("unprocessable", "There are no offers to summarise yet")

    table = "\n\n".join(
        _ranked_table_row(i + 1, row) for i, row in enumerate(top)
    )

    if not cfg.live:
        started = time.time()
        summary = heuristics.heuristic_summary(requirement, ranked)
        meta = heuristic_meta(started, "Computed from the engine factors — no model was called.")
        await record_ai_event(cfg, "Comparison summary", meta)
        return (
            {**summary, "rankedIds": [r["bid"]["id"] for r in top]},
            meta,
            len(ranked),
        )

    try:
        result = await llm.chat(
            cfg,
            [
                {
                    "role": "system",
                    "content": llm.system_prompt(
                        "Explain a shortlist of supplier offers to a buyer who has to justify the award to "
                        "colleagues.\n\n"
                        "Ground every claim in the numbers and the pitches provided. Do not recompute or "
                        "contradict the engine scores. Do not recommend a supplier whose score is not the "
                        "highest unless price or timing clearly justifies it, and say so explicitly when you do.\n\n"
                        "Return:\n"
                        '{"headline": string (max 200), "recommendation": string (2-4 sentences), '
                        '"tradeoffs": [{"providerId": string, "strength": string, "risk": string}], '
                        '"watchFor": string[], "confidence": number 0-1}'
                    ),
                },
                {
                    "role": "user",
                    "content": "\n\n".join(
                        filter(
                            None,
                            [
                                llm.untrusted(
                                    "requirement",
                                    f'{requirement.get("title")} — {requirement.get("summary")}. Ceiling '
                                    f'${requirement.get("budgetMax", 0):,}, target ${requirement.get("budgetTarget", 0):,}, '
                                    f'needed by {str(requirement.get("deadline", ""))[:10]}.',
                                ),
                                llm.untrusted("must-haves", "\n".join(requirement.get("mustHaves") or []) or "none stated"),
                                llm.untrusted("ranked offers", table),
                                llm.untrusted(
                                    "buyer priorities",
                                    f'budget {weights.get("budget")}, timeline {weights.get("timeline")}, '
                                    f'relevance {weights.get("relevance")}',
                                ),
                                llm.untrusted("buyer focus", focus) if focus else "",
                            ],
                        )
                    ),
                },
            ],
            schema=schemas.ComparisonSummary,
            temperature=0.3,
        )
        meta = meta_from(result)
        await record_ai_event(cfg, "Comparison summary", meta)
        return (
            {**result.value, "rankedIds": [r["bid"]["id"] for r in top]},
            meta,
            len(ranked),
        )
    except ApiError:
        started = time.time()
        summary = heuristics.heuristic_summary(requirement, ranked)
        return (
            {**summary, "rankedIds": [r["bid"]["id"] for r in top]},
            heuristic_meta(
                started,
                "Model call failed, heuristic answer shown. Computed from the engine factors.",
            ),
            len(ranked),
        )


def _ranked_table_row(i: int, row: dict) -> str:
    bid, score, provider = row["bid"], row["score"], row.get("provider") or {}
    factors = {f["key"]: f.get("score") for f in score.get("factors", [])}
    return (
        f'{i}. {provider.get("name") or bid.get("providerId")} (id {bid.get("providerId")}) — '
        f'${bid.get("price", 0):,}, {bid.get("deliveryDays")} days, engine score {score.get("total")}/100, '
        f'budget {factors.get("budget")}, timeline {factors.get("timeline")}, relevance {factors.get("relevance")}. '
        f'Pitch: {str(bid.get("pitch", ""))[:400]}'
    )


# ============================================================================
# 5. Copilot
# ============================================================================

async def copilot(
    cfg: Config, message: str, history: list[dict], account: dict | None
) -> tuple[str, dict[str, Any]]:
    """Natural-language assistant grounded in the signed-in account's own workspace.

    Buyers receive only their requirements and incoming offers. Sellers receive
    their own bids, public provider-profile data, and open opportunities in
    their trade; competitor offers are never fetched into their context.
    """
    if not account:
        raise ApiError("unauthorized", "You need to sign in to use the assistant.")

    role = "seller" if account.get("role") == "seller" else "buyer"
    if role == "seller":
        domain = str(account.get("domain") or "").strip()
        requirement_path = "/api/requirements?limit=100"
        if domain:
            requirement_path += f"&category={quote(domain, safe='')}"
        merchant_id = str(account.get("merchantId") or "").strip()
        bids_path = (
            f"/api/bids?providerId={quote(merchant_id, safe='')}&limit=200"
            if merchant_id
            else None
        )
        requirements_data, bids_data, providers_data = await asyncio.gather(
            next_data(cfg, requirement_path),
            next_data(cfg, bids_path) if bids_path else _empty_bids(),
            next_data(cfg, "/api/providers"),
        )
    else:
        account_id = quote(str(account.get("id") or ""), safe="")
        requirements_data, bids_data, providers_data = await asyncio.gather(
            next_data(cfg, f"/api/requirements?buyerId={account_id}&limit=100"),
            next_data(cfg, "/api/bids?limit=200"),
            next_data(cfg, "/api/providers"),
        )

    requirements = requirements_data.get("requirements", [])
    bids = bids_data.get("bids", [])
    providers = providers_data.get("providers", [])
    context, requirements_in_context = _copilot_context(
        account, role, requirements, bids, providers
    )

    if not cfg.live:
        started = time.time()
        meta = heuristic_meta(
            started,
            "No live Gemini API key is configured; no model answered this question.",
        )
        await record_ai_event(cfg, "Marketplace assistant", meta)
        return (
            "The assistant needs a live Gemini model to answer. Add GEMINI_API_KEY to .env.local "
            "and restart the FastAPI service — your marketplace data will not be changed.",
            {
                **meta,
                "requirementsInContext": requirements_in_context,
                "role": role,
            },
        )

    persona = "buyer" if role == "buyer" else "provider"
    role_rules = (
        "Use only the signed-in buyer's requirements and incoming offers. Refer to providers by their listed public profile name, and do not invent a provider capability or quote."
        if role == "buyer"
        else "Use only the signed-in seller's public profile, own bids, and open opportunities in their trade. No competitor offer data is included; do not claim to know a competitor's price, terms, or ranking."
    )
    task = (
        f"You are XMARKET's practical {persona} assistant inside a needs-first procurement marketplace. Buyers post requirements; providers send offers.\n\n"
        f"Use the signed-in user's {persona} workspace context supplied with each question. Help with ordinary marketplace work: explain requirements and offer details, surface budget or timeline trade-offs, prepare questions and checklists, improve a brief or proposal, and explain which built-in XMARKET AI action is suited to a task. For a buyer, the built-in tools can parse a brief, assess an offer's semantic fit, and explain a shortlist; for a provider, the requirement view has a bid-drafting action. Do not claim to have run those actions unless their results are in the context.\n\n"
        "Give practical, concise answers (usually two to four sentences; use bullets when they make a checklist clearer). When useful, cite the requirement title or offer/bid ID so the user can verify the detail. Separate general advice from facts in the account context. For facts missing from that context, say they are not available rather than guessing. You may make a provisional suggestion from the listed price, deadline, tags and status, but never present it as the official compatibility ranking: the deterministic XMARKET comparison engine remains authoritative. Never submit an offer, award a contract, change a status, or claim that an action was completed.\n\n"
        f"{role_rules}"
    )

    result = await llm.chat(
        cfg,
        [
            {
                "role": "system",
                "content": llm.conversation_prompt(task),
            },
            *[
                {"role": item["role"], "content": item["content"]}
                for item in history
            ],
            {
                "role": "user",
                "content": "\n\n".join(
                    [
                        llm.untrusted("signed-in workspace context", context),
                        llm.untrusted("user question", message),
                    ]
                ),
            },
        ],
        temperature=0.4,
        max_tokens=2400,
        no_cache=True,
    )
    reply = str(result.value).strip()
    if not reply:
        raise ApiError("upstream", "The model returned an empty answer. Try a shorter question.")
    meta = {
        **meta_from(result),
        "requirementsInContext": requirements_in_context,
        "role": role,
    }
    await record_ai_event(cfg, "Marketplace assistant", meta)
    return reply, meta


async def _empty_bids() -> dict[str, Any]:
    return {"bids": []}


def _copilot_context(
    account: dict,
    role: str,
    requirements: list[dict],
    bids: list[dict],
    providers: list[dict],
) -> tuple[str, int]:
    if role == "seller":
        return _seller_copilot_context(account, requirements, bids, providers)
    return _buyer_copilot_context(account, requirements, bids, providers)


def _copilot_clean(value: Any, limit: int = 360) -> str:
    if not isinstance(value, str):
        return "not provided"
    cleaned = " ".join(value.replace("\x00", " ").split())
    return cleaned[:limit] if cleaned else "not provided"


def _copilot_money(value: Any) -> str:
    try:
        return f"${round(float(value)):,}"
    except (TypeError, ValueError, OverflowError):
        return "not provided"


def _copilot_requirement_lines(requirement: dict) -> list[str]:
    return [
        f"Requirement {requirement.get('id')}: {_copilot_clean(requirement.get('title'), 140)}",
        f"  Summary: {_copilot_clean(requirement.get('summary'), 260)}",
        f"  Category: {requirement.get('category', 'not provided')}; location: {_copilot_clean(requirement.get('location'), 100)}; status: {requirement.get('status', 'not provided')}",
        f"  Budget target: {_copilot_money(requirement.get('budgetTarget'))}; hard ceiling: {_copilot_money(requirement.get('budgetMax'))}; delivery deadline: {_copilot_clean(str(requirement.get('deadline', ''))[:10], 20)}",
        f"  Specs: {_copilot_clean(requirement.get('description'), 360)}",
        f"  Tags: {', '.join(_copilot_clean(tag, 48) for tag in requirement.get('tags', [])[:8]) or 'none listed'}",
        f"  Must-haves: {'; '.join(_copilot_clean(item, 120) for item in requirement.get('mustHaves', [])[:8]) or 'none listed'}",
    ]


def _recent_key(item: dict) -> str:
    return str(item.get("createdAt") or item.get("postedAt") or "")


def _buyer_copilot_context(
    account: dict, requirements: list[dict], bids: list[dict], providers: list[dict]
) -> tuple[str, int]:
    account_id = account.get("id")
    mine = sorted(
        (r for r in requirements if r.get("buyerId") == account_id),
        key=lambda r: str(r.get("postedAt", "")),
        reverse=True,
    )
    selected = mine[:12]
    provider_by_id = {provider.get("id"): provider for provider in providers}
    sections = []

    for requirement in selected:
        offers = sorted(
            (b for b in bids if b.get("requirementId") == requirement.get("id")),
            key=_recent_key,
            reverse=True,
        )
        visible = offers[:5]
        offer_lines = []
        for bid in visible:
            provider = provider_by_id.get(bid.get("providerId"), {})
            provider_name = provider.get("name") or bid.get("providerId") or "unknown provider"
            rating = provider.get("rating", "not listed")
            reviews = provider.get("reviews", 0)
            verified = "yes" if provider.get("verified") else "no"
            offer_lines.extend(
                [
                    f"  Offer {bid.get('id')} from {_copilot_clean(str(provider_name), 100)} ({bid.get('providerId')}): {_copilot_money(bid.get('price'))}, {bid.get('deliveryDays', 'not provided')} delivery days, status {bid.get('status', 'not provided')}; rating {rating}/5, {reviews} reviews, verified {verified}.",
                    f"    Covers tags: {', '.join(_copilot_clean(tag, 48) for tag in bid.get('coversTags', [])[:8]) or 'none listed'}",
                    f"    Pitch: {_copilot_clean(bid.get('pitch'), 220)}",
                ]
            )
            milestones = bid.get("milestones", [])
            if milestones:
                offer_lines.append(
                    "    Milestones: "
                    + "; ".join(
                        f"{_copilot_clean(m.get('label'), 70)} ({m.get('days', 'not provided')} days)"
                        for m in milestones[:5]
                    )
                )
        if len(offers) > len(visible):
            offer_lines.append(f"  {len(offers) - len(visible)} older offer(s) omitted from context.")
        sections.append(
            "\n".join(
                _copilot_requirement_lines(requirement)
                + ["  Incoming offers:"]
                + (offer_lines or ["    No offers yet."])
            )
        )

    if len(mine) > len(selected):
        sections.append(
            f"{len(mine) - len(selected)} older requirement(s) omitted; the context contains the {len(selected)} most recently posted."
        )
    return (
        "\n\n".join(sections) if sections else "No requirement or offer records are available for this buyer yet.",
        len(selected),
    )


def _seller_copilot_context(
    account: dict, requirements: list[dict], bids: list[dict], providers: list[dict]
) -> tuple[str, int]:
    merchant_id = str(account.get("merchantId") or "")
    domain = account.get("domain")
    provider = next((p for p in providers if p.get("id") == merchant_id), {})
    own_bids = sorted(
        (b for b in bids if b.get("providerId") == merchant_id),
        key=_recent_key,
        reverse=True,
    )
    own_requirement_ids = {b.get("requirementId") for b in own_bids}
    open_opportunities = sorted(
        (
            r for r in requirements
            if r.get("status") == "open" and (not domain or r.get("category") == domain)
        ),
        key=lambda r: str(r.get("postedAt", "")),
        reverse=True,
    )[:12]
    own_requirements = sorted(
        (r for r in requirements if r.get("id") in own_requirement_ids),
        key=lambda r: str(r.get("postedAt", "")),
        reverse=True,
    )[:20]
    open_ids = {r.get("id") for r in open_opportunities}
    own_only = [r for r in own_requirements if r.get("id") not in open_ids]
    context_requirement_ids = open_ids | {r.get("id") for r in own_requirements}

    profile = [
        f"Shop: {_copilot_clean(str(account.get('shopName') or provider.get('name') or 'not listed'), 100)}; merchant: {_copilot_clean(str(account.get('merchantName') or provider.get('tagline') or 'not listed'), 120)}; trade: {_copilot_clean(str(domain or ', '.join(provider.get('categories', [])) or 'not listed'), 100)}.",
        f"Seller performance score: {account.get('performanceScore', 'not listed')}/100.",
        f"Profile skills: {', '.join(_copilot_clean(skill, 48) for skill in provider.get('skills', [])[:10]) or 'none listed'}.",
        f"Public profile: rating {provider.get('rating', 'not listed')}/5 from {provider.get('reviews', 0)} reviews; {provider.get('completedJobs', 0)} completed jobs; on-time rate {round(float(provider.get('onTimeRate', 0) or 0) * 100)}%.",
    ]

    recent_bids = []
    for bid in own_bids[:20]:
        requirement = next((r for r in requirements if r.get("id") == bid.get("requirementId")), {})
        recent_bids.append(
            f"  Bid {bid.get('id')} on {_copilot_clean(str(requirement.get('title') or bid.get('requirementId') or 'unknown requirement'), 120)}: {_copilot_money(bid.get('price'))}, {bid.get('deliveryDays', 'not provided')} delivery days, status {bid.get('status', 'not provided')}.\n"
            f"    Covers tags: {', '.join(_copilot_clean(tag, 48) for tag in bid.get('coversTags', [])[:8]) or 'none listed'}. Pitch: {_copilot_clean(bid.get('pitch'), 220)}"
        )

    sections = [
        "Your provider profile:",
        *[f"  {line}" for line in profile],
        "\nYour recent bids (only your own submissions; no competitor bid data is included):",
        *(recent_bids or ["  You have not submitted any bids yet."]),
    ]
    if len(own_bids) > len(recent_bids):
        sections.append(f"  {len(own_bids) - len(recent_bids)} older bid(s) omitted from context.")
    sections.extend(
        [
            "\nOpen opportunities in your trade:",
            *(
                ["\n".join(_copilot_requirement_lines(r)) for r in open_opportunities]
                or ["  No open opportunities were found in this context."]
            ),
            "\nOther requirements tied to your own bids:",
            *(
                ["\n".join(_copilot_requirement_lines(r)) for r in own_only]
                or ["  None."]
            ),
        ]
    )
    if len(requirements) > len(open_opportunities) + len(own_only):
        sections.append("The opportunity list is limited to the most recent open requirements and your own bid history.")
    return "\n".join(sections), len(context_requirement_ids)
