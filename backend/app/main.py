"""XMARKET FastAPI — entrypoint.

Run (from repo root):
    python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt
    backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000

The browser reaches this service through the Next.js rewrite
(`/fastapi/*` -> here), so all calls are same-origin.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from logging import getLogger
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
    google_reachable,
    issue_token,
    jwt_cookie_params,
    redirect_uri_for,
    require_account,
    sign_state,
)
from . import schemas

LOGGER = getLogger("xmarket.oauth2")


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
    async def health(request: Request) -> Any:
        # The redirect URI is host-derived, so it changes with the deployment
        # (localhost vs. a preview domain). Publishing it here means the one
        # thing you must paste into the Google console is a curl away instead
        # of a guess — a wrong URI is the most common reason the consent
        # screen refuses to start.
        google: dict[str, Any] = {
            "configured": cfg.google_configured,
            "redirectUri": redirect_uri_for(request, cfg),
            "reachable": None,
            "detail": "",
        }
        if cfg.google_configured:
            google.update(await google_reachable())
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
                "google": google,
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
            rate_limit(client_key(request, "ai-probe"), 6, 60_000)
            data["probe"] = await llm.health(cfg)
        data["capabilities"] = [
            {"id": "parse-requirement", "label": "Brief → structured requirement", "endpoint": "POST /v1/ai/parse-requirement"},
            {"id": "score-bid", "label": "Semantic fit for a proposal", "endpoint": "POST /v1/ai/score-bid"},
            {"id": "draft-bid", "label": "Proposal drafting for providers", "endpoint": "POST /v1/ai/draft-bid"},
            {"id": "summarize", "label": "Shortlist narrative for buyers", "endpoint": "POST /v1/ai/summarize"},
            {"id": "copilot", "label": "Role-aware marketplace assistant", "endpoint": "POST /v1/ai/copilot"},
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
        rate_limit(client_key(request, f"ai:copilot:{account['id']}"), 30, 60_000)
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
            # The URI travelled inside the signed state (see /authorize/google),
            # so this grant works across workers and concurrent sign-ins.
            redirect_uri = redirect_uri.strip() or payload.get("uri", "")
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
        if role not in ("buyer", "seller"):
            role = "buyer"
        safe_next = next if next.startswith("/") and not next.startswith("//") else "/"
        if not cfg.google_configured:
            # This is a browser navigation, not an API call: hand the user back
            # to the sign-in page with a readable reason rather than dumping a
            # JSON envelope into the tab.
            return RedirectResponse(
                f"/signin/{role}?oauth_error=not_configured", status_code=302
            )
        redirect_uri = redirect_uri_for(request, cfg)
        # The redirect URI rides inside the signed state instead of process
        # memory. Two people signing in at once — or a second uvicorn worker —
        # used to overwrite each other's URI, and the loser's code exchange
        # then failed with redirect_uri_mismatch.
        state = sign_state(
            cfg,
            {"role": role, "next": safe_next, "domain": domain, "uri": redirect_uri},
        )
        return RedirectResponse(await google_authorize_url(cfg, redirect_uri, state))

    @oauth_router.get("/callback/google")
    async def oauth_callback(
        request: Request, code: str = "", state: str = "", error: str = ""
    ) -> Any:
        """Step 2: Google returns the browser here with a code + state.

        Every failure lands the user back on the sign-in page they started
        from with `?oauth_error=<code>`, which the page renders as plain
        English. Nothing here throws: a 500 page mid-sign-in is how a
        fixable misconfiguration ends up looking like a broken app.
        """
        payload = check_state(cfg, state) or {}
        role = payload.get("role") if payload.get("role") in ("buyer", "seller") else "buyer"
        back = f"/signin/{role}"

        if not payload:
            return RedirectResponse("/signin?oauth_error=invalid_state", status_code=302)
        if error:
            # Google declined before we were involved — an unregistered
            # redirect URI, or the user backing out of the consent screen.
            return RedirectResponse(
                f"{back}?oauth_error={_google_error_code(error)}", status_code=302
            )
        if not code:
            return RedirectResponse(f"{back}?oauth_error=no_code", status_code=302)

        redirect_uri = payload.get("uri") or redirect_uri_for(request, cfg)
        try:
            profile = await google_exchange_code(cfg, code, redirect_uri)
            db: AccountsDB = request.app.state.db
            account = db.find_by_email(profile["email"])
            if not account:
                account = db.create_account(
                    role=role,
                    email=profile["email"],
                    password_hash=hash_password(_unusable_password()),
                    display_name=profile["name"],
                    domain=payload.get("domain") or None,
                    email_verified=True,
                )
            token, ttl = issue_token(cfg, account)
        except ApiError as exc:
            return RedirectResponse(f"{back}?oauth_error={exc.code}", status_code=302)
        except Exception:  # noqa: BLE001 — network/DNS/TLS faults are not ApiError
            # Almost always "this machine cannot reach Google" (no outbound
            # internet, proxy, or DNS). The health endpoint carries the detail,
            # and the traceback still goes to the service log — the user gets a
            # sentence, not a stack trace, but the log keeps both.
            LOGGER.exception("Google sign-in callback failed")
            return RedirectResponse(f"{back}?oauth_error=unreachable", status_code=302)

        secure = _is_secure(request)
        resp = RedirectResponse(payload.get("next") or "/", status_code=302)
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


def _google_error_code(error: str) -> str:
    """Google's own `error` query value -> one of our oauth_error codes.

    `redirect_uri_mismatch` is called out because it is by far the most common
    failure and the fix (register the URI /health reports) is not obvious from
    Google's wording.
    """
    known = {
        "access_denied": "cancelled",
        "redirect_uri_mismatch": "redirect_uri_mismatch",
        "invalid_client": "invalid_client",
        "invalid_scope": "invalid_scope",
        "admin_policy_enforced": "admin_policy_enforced",
        "org_internal": "org_internal",
    }
    return known.get(error.strip().lower(), "google_denied")


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


app = create_app()
