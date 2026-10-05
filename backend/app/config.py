"""Environment + service configuration.

FastAPI is a separate process from Next.js, so it does not inherit Next's
`.env.local` loading. We read the same file (and real environment variables,
which win) so a single `.env.local` configures both halves of the app.

Nothing here is a secret at import time; keys are only sent to their own
provider.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# backend/ -> repo root (the directory that holds .env.local and data/)
BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
DATA_DIR = ROOT_DIR / "data"


def _load_dotenv(path: Path) -> None:
    """Tiny .env reader (KEY=VALUE, # comments, optional quotes).

    Real environment variables always take precedence, mirroring how
    `process.env` overrides `.env.local` in Next.js.
    """
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _pick(*keys: str, default: str = "") -> str:
    for k in keys:
        v = os.environ.get(k)
        if v is not None and v.strip():
            return v.strip()
    return default


def _bool(key: str, default: bool = False) -> bool:
    v = os.environ.get(key)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


def _prefix(key: str, default: str) -> str:
    """A URL path prefix: normalised to have a leading slash (or empty)."""
    v = _pick(key, default=default).rstrip("/")
    if v and not v.startswith("/"):
        v = "/" + v
    return v


@dataclass
class Config:
    # --- Gemini (the AI provider this service calls) ----------------------
    gemini_api_key: str = ""
    gemini_model: str = DEFAULT_GEMINI_MODEL
    gemini_base_url: str = DEFAULT_GEMINI_BASE_URL
    gemini_thinking_level: str = "low"
    llm_timeout_ms: int = 30_000
    min_budget_floor: int = 250

    # --- Service reachability --------------------------------------------
    # Where the Next.js app lives (for the deterministic data endpoints the
    # AI capabilities pull context from, and for login redirects).
    next_base_url: str = "http://127.0.0.1:3000"
    # Public origin of THIS service, used to build absolute OAuth redirect
    # URIs. Falls back to the host the request came in on.
    public_base_url: str = ""
    # The path prefix the browser reaches this service under, via the Next.js
    # rewrite (source /fastapi/:path*). The proxy strips it before the request
    # arrives, so the public callback URL has to re-append it.
    fastapi_path_prefix: str = "/fastapi"
    cors_origins: list[str] = field(default_factory=lambda: ["*"])
    jwt_ttl_seconds: int = 60 * 60 * 24 * 7  # 7 days

    # --- OAuth2 / social ---------------------------------------------------
    oauth2_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    # Where to land the browser after a social sign-in. Defaults to the
    # Next.js app root.
    login_redirect: str = ""

    # --- Storage (shared with Next.js) ------------------------------------
    database_url: str = ""
    data_dir: Path = DATA_DIR
    accounts_file: Path = field(default_factory=lambda: DATA_DIR / "accounts.json")
    # Shared secret for the /api/internal/* routes on the Next.js app (the
    # audit-event writer). Mirrors the Next side: XMARKET_INTERNAL_SECRET,
    # else XMARKET_SESSION_SECRET, else the local-dev default.
    internal_secret: str = "unset-configure-me"

    @property
    def live(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    def model_mode(self) -> str:
        return "llm" if self.live else "heuristic"

    def status_note(self) -> str:
        if self.live:
            return f"Requests are sent to gemini ({self.gemini_model})."
        return (
            "No GEMINI_API_KEY configured — AI endpoints return the "
            "deterministic heuristic output and are labelled as such."
        )


def load_config() -> Config:
    _load_dotenv(ROOT_DIR / ".env.local")
    _load_dotenv(ROOT_DIR / ".env")

    cors_raw = _pick("CORS_ORIGINS", "FASTAPI_CORS_ORIGINS", default="*")
    origins = [o.strip() for o in cors_raw.split(",") if o.strip()]

    cfg = Config(
        gemini_api_key=_pick("GEMINI_API_KEY", "GOOGLE_API_KEY"),
        gemini_model=_pick("GEMINI_MODEL", default=DEFAULT_GEMINI_MODEL),
        gemini_base_url=_pick(
            "GEMINI_BASE_URL", default=DEFAULT_GEMINI_BASE_URL
        ).rstrip("/"),
        gemini_thinking_level=_pick("GEMINI_THINKING_LEVEL", default="low"),
        llm_timeout_ms=int(_pick("LLM_TIMEOUT_MS", default="30000") or 30_000),
        min_budget_floor=int(_pick("XMARKET_MIN_BUDGET", default="250") or 250),
        next_base_url=_pick("NEXT_BASE_URL", default="http://127.0.0.1:3000").rstrip("/"),
        public_base_url=_pick("XMARKET_FASTAPI_URL", "PUBLIC_BASE_URL").rstrip("/"),
        fastapi_path_prefix=_prefix("XMARKET_FASTAPI_PREFIX", "/fastapi"),
        cors_origins=origins,
        jwt_ttl_seconds=int(_pick("XMARKET_JWT_TTL_SECONDS", default="604800") or 604800),
        oauth2_secret=_pick("XMARKET_OAUTH2_SECRET", "JWT_SECRET", "XMARKET_SESSION_SECRET"),
        google_client_id=_pick("GOOGLE_CLIENT_ID"),
        google_client_secret=_pick("GOOGLE_CLIENT_SECRET"),
        login_redirect=_pick("XMARKET_LOGIN_REDIRECT", "FRONTEND_URL").rstrip("/"),
        database_url=_pick("DATABASE_URL"),
        data_dir=DATA_DIR,
        accounts_file=DATA_DIR / "accounts.json",
        internal_secret=_pick("XMARKET_INTERNAL_SECRET", "XMARKET_SESSION_SECRET")
        or "unset-configure-me",
    )
    return cfg
