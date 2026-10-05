"""Account + session storage, shared with the Next.js app.

Credentials live deliberately outside the main marketplace store so a demo
reset never wipes passwords — that rule is defined in the TypeScript app and
this module simply honours the same layout:

    JSON file mode (no DATABASE_URL)
        data/accounts.json  -> JSON array of Account objects (camelCase,
                               exactly as `JSON.stringify` in TS emits them)
        data/sessions.json  -> array of {token, accountId, createdAt,
                               expiresAt, revokedAt}
        data/xmarket.json   -> the marketplace store; new buyers/sellers are
                               bridged in here so names resolve in awards.

    Postgres mode (DATABASE_URL set)
        the same tables the TS app creates: `accounts` and `sessions`
        (doc jsonb is the source of truth for the object shape), plus
        `buyers`/`providers` for the bridges.
"""

from __future__ import annotations

import json
import os
import random
import string
import time
from datetime import datetime, timezone
from typing import Any

import bcrypt
import httpx

from .config import Config

BCRYPT_ROUNDS = 10

DOMAIN_CODES: dict[str, str] = {
    "software": "SW",
    "manufacturing": "MF",
    "logistics": "LG",
    "design": "DS",
    "construction": "CN",
    "electronics": "EL",
}

ACCOUNTS_SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
  id                text PRIMARY KEY,
  role              text NOT NULL,
  email             text NOT NULL UNIQUE,
  password_hash     text NOT NULL,
  display_name      text NOT NULL,
  company           text,
  merchant_id       text UNIQUE,
  merchant_name     text,
  shop_name         text,
  domain            text,
  performance_score integer NOT NULL DEFAULT 50,
  created_at        timestamptz NOT NULL DEFAULT now(),
  doc               jsonb NOT NULL
);
"""

SESSIONS_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  token       text PRIMARY KEY,
  account_id  text NOT NULL,
  created_at  timestamptz NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class AccountsDB:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._pool = None  # psycopg2 connection, lazily opened

    # ------------------------------------------------------------------ pg
    def _conn(self):
        if self._pool is None:
            import psycopg2

            self._pool = psycopg2.connect(self.cfg.database_url)
        return self._pool

    def _ensure_schemas(self) -> None:
        if self.cfg.database_url:
            conn = self._conn()
            with conn.cursor() as cur:
                cur.execute(ACCOUNTS_SCHEMA)
                cur.execute(SESSIONS_SCHEMA)
            conn.commit()

    # --------------------------------------------------------------- files
    def _read_json(self, path, default):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return default

    @staticmethod
    def _write_json_atomic(path, data) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.{os.getpid()}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, path)

    # ------------------------------------------------------------ accounts
    def list_accounts(self) -> list[dict[str, Any]]:
        self._ensure_schemas()
        if self.cfg.database_url:
            with self._conn().cursor() as cur:
                cur.execute("SELECT doc FROM accounts")
                return [row[0] for row in cur.fetchall()]
        return self._read_json(self.cfg.accounts_file, [])

    def find_by_email(self, email: str) -> dict[str, Any] | None:
        needle = email.strip().lower()
        for account in self.list_accounts():
            if account.get("email") == needle:
                return account
        return None

    def find_by_id(self, account_id: str) -> dict[str, Any] | None:
        for account in self.list_accounts():
            if account.get("id") == account_id:
                return account
        return None

    def _append_account(self, account: dict[str, Any]) -> None:
        doc = json.dumps(account)
        if self.cfg.database_url:
            with self._conn().cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO accounts
                      (id, role, email, password_hash, display_name, company,
                       merchant_id, merchant_name, shop_name, domain,
                       performance_score, created_at, doc)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        account["id"], account["role"], account["email"],
                        account["passwordHash"], account["displayName"],
                        account.get("company"), account.get("merchantId"),
                        account.get("merchantName"), account.get("shopName"),
                        account.get("domain"), account.get("performanceScore", 50),
                        account["createdAt"], doc,
                    ),
                )
            self._conn().commit()
            return

        accounts = self._read_json(self.cfg.accounts_file, [])
        accounts.append(account)
        self._write_json_atomic(self.cfg.accounts_file, accounts)

    def create_account(
        self,
        *,
        role: str,
        email: str,
        password_hash: str,
        display_name: str,
        company: str | None = None,
        merchant_name: str | None = None,
        shop_name: str | None = None,
        domain: str | None = None,
        email_verified: bool | None = True,
    ) -> dict[str, Any]:
        """Create an account, mirroring createBuyer/createSeller in TS.

        Raises ValueError when the email is already taken (callers map that
        to a 409 conflict, the same way the TS register route does).
        """
        email = email.strip().lower()
        if self.find_by_email(email):
            raise ValueError("An account with that email already exists.")

        account: dict[str, Any] = {
            "id": "acc_" + _random_token(12),
            "role": role,
            "email": email,
            "passwordHash": password_hash,
            "displayName": display_name.strip(),
            "performanceScore": 50,
            "createdAt": _now_iso(),
        }
        if email_verified is not None:
            account["emailVerified"] = email_verified

        if role == "buyer":
            if company:
                account["company"] = company.strip()
            self._append_account(account)
            self.bridge_buyer(account)
            return account

        # Seller: the merchant id is platform-issued, never chosen.
        taken = {a.get("merchantId") for a in self.list_accounts() if a.get("merchantId")}
        merchant_id = new_merchant_id(domain, taken)
        account["merchantId"] = merchant_id
        account["merchantName"] = (merchant_name or "").strip()
        account["shopName"] = (shop_name or "").strip()
        account["domain"] = domain
        account["displayName"] = (shop_name or display_name).strip()
        self._append_account(account)
        self.bridge_provider(account)
        return account

    # ------------------------------------------------------------ bridging
    def bridge_buyer(self, account: dict[str, Any]) -> None:
        """Give the buyer a readable row in the marketplace store.

        Without it, an award notification shows a raw account id instead of
        who finalised the offer. No-op when the row already exists.
        """
        initials = _initials(account.get("displayName", ""))
        buyer = {
            "id": account["id"],
            "name": account.get("displayName", ""),
            "company": account.get("company") or "—",
            "location": "—",
            "initials": initials,
            "rating": 0,
            "posted": 0,
            "awarded": 0,
        }
        self._upsert_store_row("buyers", buyer)

    def bridge_provider(self, account: dict[str, Any]) -> None:
        """The merchant id must resolve as a provider or every bid this seller
        places is rejected as an unknown provider."""
        domain = account.get("domain") or ""
        provider = {
            "id": account["merchantId"],
            "name": account.get("shopName", ""),
            "tagline": f'{account.get("merchantName", "")} — {domain}'.strip(" —"),
            "location": "—",
            "initials": _initials(account.get("shopName", "")),
            "categories": [domain] if domain else [],
            "skills": [],
            "rating": 0,
            "reviews": 0,
            "completedJobs": 0,
            "onTimeRate": 1,
            "responseHours": 24,
            "verified": False,
            "memberSince": datetime.now(timezone.utc).year,
        }
        self._upsert_store_row("providers", provider)

    def _upsert_store_row(self, table: str, doc: dict[str, Any]) -> None:
        if self.cfg.database_url:
            conn = self._conn()
            if table == "buyers":
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO buyers (id, doc) VALUES (%s, %s) "
                        "ON CONFLICT (id) DO NOTHING",
                        (doc["id"], json.dumps(doc)),
                    )
            else:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO providers (id, name, rating, verified, doc)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (doc["id"], doc.get("name", ""), doc.get("rating", 0),
                         doc.get("verified", False), json.dumps(doc)),
                    )
            conn.commit()
            return

        store_path = self.cfg.data_dir / "xmarket.json"
        store = self._read_json(store_path, None)
        if not isinstance(store, dict):
            return  # store not created yet — the TS app will seed it
        rows = store.setdefault(table, [])
        if any(r.get("id") == doc["id"] for r in rows):
            return
        rows.insert(0, doc)
        self._write_json_atomic(store_path, store)

    # ------------------------------------------------------------- sessions
    def read_session(self, token: str) -> dict[str, Any] | None:
        """Valid (unrevoked, unexpired) session row for a cookie token, or None."""
        if not token:
            return None
        row: dict[str, Any] | None = None
        if self.cfg.database_url:
            self._ensure_schemas()
            with self._conn().cursor() as cur:
                cur.execute(
                    "SELECT token, account_id, created_at, expires_at, revoked_at "
                    "FROM sessions WHERE token = %s",
                    (token,),
                )
                found = cur.fetchone()
            if found:
                row = {
                    "token": found[0],
                    "accountId": found[1],
                    "createdAt": _to_iso(found[2]),
                    "expiresAt": _to_iso(found[3]),
                    "revokedAt": _to_iso(found[4]),
                }
        else:
            rows = self._read_json(self.cfg.data_dir / "sessions.json", [])
            row = next((r for r in rows if r.get("token") == token), None)

        if not row or row.get("revokedAt"):
            return None
        try:
            if datetime.fromisoformat(row["expiresAt"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
                return None
        except (KeyError, ValueError):
            return None
        return row


# ------------------------------------------------------------------ helpers

def _random_token(n: int) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(n))


def _initials(name: str) -> str:
    return "".join(w[:1].upper() for w in name.split()[:2] if w)


def _to_iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat().replace("+00:00", "Z")


def new_merchant_id(domain: str | None, taken: set[str]) -> str:
    code = DOMAIN_CODES.get(domain or "", "GN")
    for _ in range(50):
        candidate = f"XM-{code}-{random.randint(1000, 9999)}"
        if candidate not in taken:
            return candidate
    return f"XM-{code}-{int(time.time() * 1000)}"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(BCRYPT_ROUNDS)).decode("ascii")


def verify_password(account: dict[str, Any], password: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            account.get("passwordHash", "$2b$10$invalid").encode("ascii"),
        )
    except ValueError:
        return False


def public_account(account: dict[str, Any]) -> dict[str, Any]:
    """Strip the hash before an account is ever sent to the browser."""
    return {k: v for k, v in account.items() if k != "passwordHash"}
