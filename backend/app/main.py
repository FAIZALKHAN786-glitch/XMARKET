"""XMARKET FastAPI — entrypoint.

Run (from repo root):
    python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt
    backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000

The browser reaches this service through the Next.js rewrite
(`/fastapi/*` -> here), so all calls are same-origin.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from . import __version__, ai, llm
from .accounts import AccountsDB
from .config import load_config
from .envelope import ApiError, install_error_handlers, ok
from .rate_limit import client_key, rate_limit
from .accounts import hash_password, public_account, verify_password
from .security import (
    COOKIE,
    SESSION_COOKIE,
    check_state,
    google_authorize_url,
    google_exchange_code,
    issue_token,
    jwt_cookie_params,
    redirect_uri_for,
    require_account,
    sign_state,
)
from . import schemas


@asynccontextmanager
async def lifespan(_: FastAPI):
    cfg: Any = _.state.cfg
    db: AccountsDB = _.state.db
    db.list_accounts()  # pre-open the store (and schemas, in Postgres mode)
    yield


def create_app() -> FastAPI:
    cfg = load_config()

    app = FastAPI(
        title="XMARKET FastAPI",
        version=__version__,
        description="AI (Gemini) + OAuth2 backend for the XMARKET marketplace.",
        lifespan=lifespan,
    )
    app.state.cfg = cfg
    app.state.db = AccountsDB(cfg)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    ai_router = APIRouter(prefix="/v1/ai", tags=["ai"])
    oauth_router = APIRouter(prefix="/v1/oauth2", tags=["oauth2"])

    # ================================================================ /health
    @app.get("/health")
    async def health() -> Any:
        return ok(
            {
                "ok": True,
                "service": "xmarket-fastapi",
                "version": __version__,
                "ai": {
                    "provider": "gemini",
                    "model": cfg.gemini_model,
                    "live": cfg.live,
                    "mode": cfg.model_mode(),
                },
                "googleSignIn": cfg.google_configured,
            }
        )

    # ===================================================================== AI
    @ai_router.get("/status")
    async def ai_status(request: Request, probe: bool = Query(default=False, alias="probe")) -> Any:
        """Which provider is answering, plus a recent activity trace.

        `?probe=1` additionally calls the provider so a broken key is
        reported as broken instead of merely "configured".
        """
        data: dict[str, Any] = {
            "provider": "gemini",
            "model": cfg.gemini_model,
            "live": cfg.live,
            "mode": cfg.model_mode(),
            "note": cfg.status_note(),
        }
        if probe:
            data["probe"] = await llm.health(cfg)
        data["capabilities"] = [
            {"id": "parse-requirement", "label": "Brief → structured requirement", "endpoint": "POST /v1/ai/parse-requirement"},
            {"id": "score-bid", "label": "Semantic fit for a proposal", "endpoint": "POST /v1/ai/score-bid"},
            {"id": "draft-bid", "label": "Proposal drafting for providers", "endpoint": "POST /v1/ai/draft-bid"},
            {"id": "summarize", "label": "Shortlist narrative for buyers", "endpoint": "POST /v1/ai/summarize"},
        ]
        # Recent AI activity from the shared audit log (read via the app).
        try:
            events = await ai.next_data(cfg, "/api/events?limit=40&type=ai.invoked")
            data["recent"] = events.get("events", [])[:8]
        except Exception:  # noqa: BLE001 — trace is best-effort
            data["recent"] = []
        return ok(data)

    @ai_router.post("/parse-requirement")
    async def ai_parse(request: Request, input: schemas.ParseRequirementInput, _account: dict = Depends(require_account)) -> Any:
        rate_limit(client_key(request, "ai-parse"), 20, 60_000)
        defaults = input.defaults or {}
        draft, meta = await ai.parse_requirement(cfg, input.brief, defaults)
        return ok({"draft": _with_deadlines(draft), "meta": meta})

    @ai_router.post("/score-bid")
    async def ai_score(request: Request, input: schemas.ScoreBidInput, _account: dict = Depends(require_account)) -> Any:
        rate_limit(client_key(request, "ai-score"), 30, 60_000)
        requirement = await _requirement(cfg, input.requirement_id)
        bid = await _bid_for(cfg, input.bid_id, input.requirement_id)
        provider = await _provider(cfg, bid.get("providerId"))
        semantic, meta = await ai.score_semantic_fit(cfg, requirement, bid, provider)
        return ok(
            {
                "semantic": semantic,
                "blendHint": {
                    "note": "Add ?wSemantic=0.25 to the compare endpoint to blend this into the total.",
                    "suggestedWeight": 0.25,
                },
                "meta": meta,
            }
        )

    @ai_router.post("/draft-bid")
    async def ai_draft(request: Request, input: schemas.DraftBidInput, _account: dict = Depends(require_account)) -> Any:
        rate_limit(client_key(request, "ai-draft"), 20, 60_000)
        requirement = await _requirement(cfg, input.requirement_id)
        provider = await _provider(cfg, input.provider_id or "p_me")
        draft, meta = await ai.draft_bid(
            cfg,
            requirement,
            provider,
            {
                "targetPrice": input.target_price,
                "deliveryDays": input.delivery_days,
                "notes": input.notes,
            },
        )
        return ok(
            {
                "draft": draft,
                "requirement": {
                    "id": requirement.get("id"),
                    "title": requirement.get("title"),
                    "tags": requirement.get("tags", []),
                    "budgetMax": requirement.get("budgetMax"),
                    "budgetTarget": requirement.get("budgetTarget"),
                },
                "meta": meta,
            }
        )

    @ai_router.post("/summarize")
    async def ai_summarize(request: Request, input: schemas.SummarizeInput, _account: dict = Depends(require_account)) -> Any:
        rate_limit(client_key(request, "ai-summary"), 20, 60_000)
        requirement = await _requirement(cfg, input.requirement_id)
        weights = (
            {"budget": input.weights.budget, "timeline": input.weights.timeline, "relevance": input.weights.relevance}
            if input.weights
            else {}
        )
        summary, meta, offer_count = await ai.summarize_comparison(cfg, requirement, weights, input.focus)
        return ok({"summary": summary, "offerCount": offer_count, "meta": meta})

    @ai_router.post("/copilot")
    async def ai_copilot(request: Request, input: schemas.CopilotInput, account: dict = Depends(require_account)) -> Any:
        rate_limit("ai:copilot", 30, 60_000)
        reply, meta = await ai.copilot(cfg, input.message, [h.model_dump() for h in input.history], account)
        return ok({"reply": reply, "meta": meta})

    # ================================================================ OAuth2
    @oauth_router.post("/token")
    async def oauth_token(
        request: Request,
        grant_type: str = Form(default=""),
        username: str = Form(default=""),
        password: str = Form(default=""),
        role: str | None = Form(default=None),
        code: str = Form(default=""),
        state: str = Form(default=""),
        redirect_uri: str = Form(default=""),
    ) -> Any:
        """OAuth2 token endpoint (form-encoded, per the RFC).

        grant_type=password           username (email) + password
        grant_type=authorization_code code + state        (Google sign-in)
        grant_type=session            (cookie)            (upgrade existing login)
        """
        grant = grant_type.strip().lower()
        db: AccountsDB = request.app.state.db

        if grant == "password":
            username = username.strip()
            if not username or not password:
                raise ApiError("unauthorized", "Email or password is incorrect.")
            account = db.find_by_email(username)
            invalid = ApiError("unauthorized", "Email or password is incorrect.")
            if not account:
                raise invalid
            if role in ("buyer", "seller") and account.get("role") != role:
                raise invalid
            if not verify_password(account, password):
                raise invalid
            token, ttl = issue_token(cfg, account)
            data = _token_payload(token, ttl, account)
            return ok(data, headers=_jwt_cookie_headers(cfg, token, _is_secure(request)))

        if grant == "authorization_code":
            payload = check_state(cfg, state)
            if not code or not payload:
                raise ApiError("unauthorized", "Invalid or expired sign-in state.")
            redirect_uri = redirect_uri.strip() or _stored_redirect.get("uri", "")
            profile = await google_exchange_code(cfg, code, redirect_uri)
            account = db.find_by_email(profile["email"])
            if not account:
                account = db.create_account(
                    role=payload.get("role", "buyer"),
                    email=profile["email"],
                    password_hash=hash_password(_unusable_password()),
                    display_name=profile["name"],
                    domain=payload.get("domain") or None,
                    email_verified=True,
                )
            token, ttl = issue_token(cfg, account)
            data = _token_payload(token, ttl, account)
            return ok(data, headers=_jwt_cookie_headers(cfg, token, _is_secure(request)))

        if grant == "session":
            cookie_token = request.cookies.get(SESSION_COOKIE)
            row = db.read_session(cookie_token) if cookie_token else None
            if not row:
                raise ApiError("unauthorized", "You need to sign in to do that.")
            account = db.find_by_id(row.get("accountId", ""))
            if not account:
                raise ApiError("unauthorized", "You need to sign in to do that.")
            token, ttl = issue_token(cfg, account)
            data = _token_payload(token, ttl, account)
            return ok(data, headers=_jwt_cookie_headers(cfg, token, _is_secure(request)))

        raise ApiError("bad_request", f"Unsupported grant_type: {grant or '(missing)'}")

    @oauth_router.get("/authorize/google")
    async def oauth_authorize(
        request: Request,
        role: str = Query(default="buyer"),
        next: str = Query(default="/", alias="next"),
        domain: str = Query(default=""),
    ) -> Any:
        """Step 1 of Google sign-in: send the browser to the consent screen."""
        if not cfg.google_configured:
            raise ApiError(
                "ai_unavailable",
                "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and "
                "GOOGLE_CLIENT_SECRET in .env.local and restart the FastAPI service.",
            )
        if role not in ("buyer", "seller"):
            role = "buyer"
        safe_next = next if next.startswith("/") and not next.startswith("//") else "/"
        state = sign_state(cfg, {"role": role, "next": safe_next, "domain": domain})
        # Remember the redirect URI for the callback (it is request-derived).
        _stored_redirect["uri"] = redirect_uri_for(request, cfg)
        return RedirectResponse(await google_authorize_url(cfg, _stored_redirect["uri"], state))

    @oauth_router.get("/callback/google")
    async def oauth_callback(request: Request, code: str = "", state: str = "") -> Any:
        """Step 2: Google returns the browser here with a code + state."""
        payload = check_state(cfg, state)
        if not payload:
            raise ApiError("unauthorized", "Invalid or expired sign-in state.")
        redirect_uri = _stored_redirect.get("uri") or redirect_uri_for(request, cfg)
        try:
            profile = await google_exchange_code(cfg, code, redirect_uri)
            db: AccountsDB = request.app.state.db
            account = db.find_by_email(profile["email"])
            if not account:
                account = db.create_account(
                    role=payload.get("role", "buyer"),
                    email=profile["email"],
                    password_hash=hash_password(_unusable_password()),
                    display_name=profile["name"],
                    domain=payload.get("domain") or None,
                    email_verified=True,
                )
            token, ttl = issue_token(cfg, account)
        except ApiError as exc:
            # Land the user somewhere useful instead of a raw error page.
            return RedirectResponse(f'/signin?oauth_error={exc.code}', status_code=302)

        secure = _is_secure(request)
        resp = RedirectResponse(payload.get("next", "/"), status_code=302)
        resp.set_cookie(COOKIE, token, **jwt_cookie_params(cfg, secure))
        return resp

    @oauth_router.post("/revoke")
    async def oauth_revoke(request: Request) -> Any:
        resp = ok({"revoked": True})
        secure = _is_secure(request)
        resp.delete_cookie(COOKIE, **{k: v for k, v in jwt_cookie_params(cfg, secure).items() if k != "max_age"})
        return resp

    app.include_router(ai_router)
    app.include_router(oauth_router)
    return app


# ------------------------------------------------------------------- helpers

async def _requirement(cfg: Any, requirement_id: str) -> dict[str, Any]:
    try:
        data = await ai.next_data(cfg, f"/api/requirements/{requirement_id}")
    except ApiError:
        raise
    requirement = data.get("requirement")
    if not requirement:
        raise ApiError("not_found", f"No requirement with id {requirement_id}")
    return requirement


async def _bid_for(cfg: Any, bid_id: str, requirement_id: str) -> dict[str, Any]:
    data = await ai.next_data(cfg, f"/api/bids/{bid_id}")
    bid = data.get("bid")
    if not bid or bid.get("requirementId") != requirement_id:
        raise ApiError("not_found", f"No bid {bid_id} on requirement {requirement_id}")
    return bid


async def _provider(cfg: Any, provider_id: str | None) -> dict[str, Any]:
    if not provider_id:
        return {}
    try:
        data = await ai.next_data(cfg, "/api/providers")
    except ApiError:
        return {}
    for provider in data.get("providers", []):
        if provider.get("id") == provider_id:
            return provider
    return {}


def _with_deadlines(draft: dict) -> dict:
    """Mirror the TS route: add absolute deadline/closesAt to the draft."""
    now = int(__import__("time").time())
    draft = dict(draft)
    draft["deadline"] = _iso(now + draft.get("deadlineInDays", 0) * 86400)
    draft["closesAt"] = _iso(now + draft.get("closingInDays", 14) * 86400)
    return draft


def _iso(ts: int) -> str:
    import datetime

    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def _unusable_password() -> str:
    import secrets

    return secrets.token_urlsafe(32)


def _token_payload(token: str, ttl: int, account: dict) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ttl,
        "account": public_account(account),
        "merchantId": account.get("merchantId"),
    }


def _jwt_cookie_headers(cfg, token: str, secure: bool) -> dict:
    """Set-Cookie for a freshly issued token. Path "/" so the app (not just
    /fastapi/*) can read xmarket_jwt and recognise the signed-in account."""
    p = jwt_cookie_params(cfg, secure)
    parts = [f"{COOKIE}={token}"]
    if p.get("max_age") is not None:
        parts.append(f"Max-Age={p['max_age']}")
    if p.get("httponly"):
        parts.append("HttpOnly")
    if p.get("secure"):
        parts.append("Secure")
    parts.append(f"SameSite={str(p.get('samesite', 'lax')).capitalize()}")
    if p.get("path"):
        parts.append(f"Path={p['path']}")
    return {"Set-Cookie": "; ".join(parts)}


def _is_secure(request: Request) -> bool:
    proto = request.headers.get("x-forwarded-proto", "")
    if proto:
        return proto.split(",")[0].strip() == "https"
    return request.url.scheme == "https"


# Redirect URIs derived from requests, kept per-process (single instance).
_stored_redirect: dict[str, str] = {"uri": ""}


app = create_app()
