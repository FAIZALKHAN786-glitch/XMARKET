"""One response shape, one place for error codes — mirrors lib/server/http.ts.

Every endpoint in this service returns the same envelope the Next.js API
uses, so the frontend can treat both backends interchangeably:

    { "ok": true,  "data": ... }
    { "ok": false, "error": { "code", "message", "details?" } }
"""

from __future__ import annotations

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

STATUS: dict[str, int] = {
    "bad_request": 400,
    "not_found": 404,
    "conflict": 409,
    "unprocessable": 422,
    "rate_limited": 429,
    "unauthorized": 401,
    "forbidden": 403,
    "ai_unavailable": 503,
    # The configured LLM provider rejected our key — server-side config fault.
    "auth": 502,
    "upstream": 502,
    "internal": 500,
}


class ApiError(Exception):
    def __init__(self, code: str, message: str, details: object | None = None):
        super().__init__(message)
        if code not in STATUS:
            raise ValueError(f"unknown error code: {code}")
        self.code = code
        self.message = message
        self.details = details

    @property
    def http_status(self) -> int:
        return STATUS[self.code]


def ok(data: object, status_code: int = 200, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"ok": True, "data": data},
        headers=headers,
    )


def fail(code: str, message: str, details: object | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=STATUS[code],
        content={"ok": False, "error": {"code": code, "message": message, **({"details": details} if details is not None else {})}},
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def on_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return fail(exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def on_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {
                "path": ".".join(str(p) for p in e.get("loc", [])) or "(root)",
                "message": e.get("msg", "invalid"),
            }
            for e in exc.errors()
        ]
        return fail("bad_request", "Request failed validation", details)

    @app.exception_handler(Exception)
    async def on_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # Never leak internals; the message is logged by uvicorn's access log
        # and traceback, not returned to the caller.
        return fail("internal", "Something went wrong", {"message": str(exc)})
