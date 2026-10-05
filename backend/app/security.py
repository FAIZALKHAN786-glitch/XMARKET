"""OAuth2: JWT issuance/verification and the Google authorization-code flow.

Tokens are opaque HS256 JWTs — the same family of design the Next.js app
uses for its cookie sessions (opaque tokens, server-side truth). Two extra
grants live on top of the standard OAuth2 password grant:

  * `session` — trades the existing `xmarket_session` cookie for a JWT, so a
    user already signed in with email/password can get a bearer token without
    retyping anything (e.g. after a page refresh);
  * `authorization_code` — Google social sign-in.

Authentication on protected routes accepts either `Authorization: Bearer <jwt>`
or the `xmarket_jwt` cookie (set by the social callback), so the browser works
the same whether the token came from a grant or from Google.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

import httpx
import jwt
from fastapi import Cookie, Header, Request

from .accounts import AccountsDB
from .config import Config
from .envelope import ApiError

ISSUER = "xmarket"
AUDIENCE = "xmarket-api"
COOKIE = "xmarket_jwt"
SESSION_COOKIE = "xmarket_session"

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class AuthError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _secret(cfg: Config) -> bytes:
    # Must match lib/server/session.ts jwtSecret() on the Next.js side: the
    # app verifies the xmarket_jwt cookie (Google sign-in) with the same key.
    secret = cfg.oauth2_secret or "unset-configure-me"
    return secret.encode("utf-8")


# --------------------------------------------------------------------- JWT

def issue_token(cfg: Config, account: dict[str, Any]) -> tuple[str, int]:
    now = int(time.time())
    ttl = cfg.jwt_ttl_seconds
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": account["id"],
        "email": account["email"],
        "role": account["role"],
        "name": account.get("displayName", ""),
        "merchantId": account.get("merchantId"),
        "iat": now,
        "exp": now + ttl,
    }
    token = jwt.encode(claims, _secret(cfg), algorithm="HS256")
    if isinstance(token, bytes):  # PyJWT < 2
        token = token.decode("ascii")
    return token, ttl


def verify_token(cfg: Config, token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            _secret(cfg),
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Invalid token") from exc


def bearer_from_request(
    request: Request,
    authorization: str | None = Header(default=None),
    xmarket_jwt: str | None = Cookie(default=None),
) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return xmarket_jwt


def current_account(request: Request, db: AccountsDB) -> dict[str, Any]:
    """A valid JWT (Authorization header or xmarket_jwt cookie) -> the account.

    Reads straight off the request so it can be used as a plain call from
    route handlers (and as a dependency, via the wrapper below).
    """
    authorization = request.headers.get("authorization")
    token = bearer_from_request(request, authorization, request.cookies.get(COOKIE))
    if not token:
        raise ApiError("unauthorized", "You need to sign in to do that.")
    claims = verify_token(request.app.state.cfg, token)
    account = db.find_by_id(claims.get("sub", ""))
    if not account:
        raise ApiError("unauthorized", "You need to sign in to do that.")
    return account


def require_account(request: Request) -> dict[str, Any]:
    """FastAPI dependency form of current_account()."""
    return current_account(request, request.app.state.db)


def jwt_cookie_params(cfg: Config, secure: bool) -> dict[str, Any]:
    # Path "/" on purpose: the same cookie authenticates the FastAPI service
    # (via the /fastapi/* rewrite) AND lets the Next.js app recognise the
    # signed-in account (it verifies xmarket_jwt in currentAccount). A
    # /fastapi-only path would keep the app logged out after a social sign-in.
    return {
        "max_age": cfg.jwt_ttl_seconds,
        "httponly": True,
        "secure": secure,
        "samesite": "lax",
        "path": "/",
    }


# ------------------------------------------------------- Google state/nonce

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_state(cfg: Config, payload: dict[str, Any]) -> str:
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    mac = hmac.new(_secret(cfg), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64url(mac)}"


def check_state(cfg: Config, state: str) -> dict[str, Any] | None:
    try:
        body, _, mac = state.partition(".")
        expected = _b64url(
            hmac.new(_secret(cfg), body.encode("ascii"), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(mac, expected):
            return None
        return json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    except Exception:
        return None


# ----------------------------------------------------------------- Google

async def google_authorize_url(
    cfg: Config, redirect_uri: str, state: str
) -> str:
    from urllib.parse import urlencode

    params = {
        "client_id": cfg.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def google_exchange_code(
    cfg: Config, code: str, redirect_uri: str
) -> dict[str, Any]:
    """Code -> id_token -> profile {email, email_verified, name}."""
    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": cfg.google_client_id,
                "client_secret": cfg.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code >= 300:
            raise ApiError(
                "upstream",
                f"Google token exchange failed ({token_res.status_code}).",
            )
        token_json = token_res.json()
        id_token = token_json.get("id_token")
        if not id_token:
            raise ApiError("upstream", "Google did not return an id_token.")

        profile_res = await client.get(
            GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {id_token}"}
        )
        if profile_res.status_code >= 300:
            raise ApiError("upstream", "Google profile fetch failed.")
        profile = profile_res.json()

    if not profile.get("email") or not profile.get("email_verified", True):
        raise ApiError("unauthorized", "Google did not confirm a verified email.")
    return {
        "email": profile["email"].strip().lower(),
        "name": profile.get("name") or profile["email"].split("@")[0],
        "picture": profile.get("picture"),
    }


def redirect_uri_for(request: Request, cfg: Config) -> str:
    """Absolute URL of this service's Google callback, as the browser sees it.

    Behind the Next.js rewrite the browser reaches this service at
    {public-origin}{prefix}/*, but the proxy (a) sets Host to the backend
    (127.0.0.1:8000) and (b) strips the /fastapi prefix before the request
    arrives. So `request.base_url` is NOT the public URL. Rebuild it from the
    x-forwarded-* headers the proxy preserves, and re-append the prefix. That
    is the URL the user must register in the Google console.

    An explicit XMARKET_FASTAPI_URL (public origin) wins over the derived one.
    """
    if cfg.public_base_url:
        return cfg.public_base_url.rstrip("/") + "/v1/oauth2/callback/google"
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme)
    proto = proto.split(",")[0].strip()
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    )
    return f"{proto}://{host}{cfg.fastapi_path_prefix}/v1/oauth2/callback/google"
