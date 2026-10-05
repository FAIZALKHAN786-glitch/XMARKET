"""Naive fixed-window limiter — enough to stop a runaway client or a bill.

Same shape as lib/server/http.ts's rateLimit(): a per-key counter that resets
after the window. In-memory, so it is per-process; that is fine for a single
service instance and for the abuse we are guarding against here.
"""

from __future__ import annotations

import time

from .envelope import ApiError

_buckets: dict[str, tuple[int, float]] = {}


def rate_limit(key: str, limit: int, window_ms: int) -> None:
    now = time.time() * 1000
    count, reset_at = _buckets.get(key, (0, 0.0))
    if now >= reset_at:
        count, reset_at = 0, now + window_ms
    count += 1
    _buckets[key] = (count, reset_at)
    if count > limit:
        seconds = max(1, int((reset_at - now) // 1000) + 1)
        raise ApiError(
            "rate_limited",
            f"Rate limit exceeded — try again in {seconds}s",
            {"limit": limit, "windowMs": window_ms},
        )


def client_key(request, scope: str) -> str:
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip")
        or "local"
    )
    return f"{scope}:{ip}"
