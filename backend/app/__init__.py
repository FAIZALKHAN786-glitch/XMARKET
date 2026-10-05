"""XMARKET FastAPI — AI + OAuth2 backend.

The marketplace data APIs stay in the Next.js app. This service owns:

  * authentication — OAuth2 password grant (email/password -> JWT) and
    Google social sign-in (authorization-code flow), plus a `session`
    exchange grant that upgrades the existing cookie login into a JWT;
  * the AI layer — Gemini calls for parse/score/draft/summarise/copilot,
    with the deterministic heuristics as fallback, mirroring the envelope
    and meta of the Next.js `/api/ai/*` routes.
"""

__version__ = "1.0.0"
