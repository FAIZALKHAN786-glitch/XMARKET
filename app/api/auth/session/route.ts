import { ok, route } from "@/lib/server/http";
import { publicAccount } from "@/lib/server/accounts";
import { currentAccount } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session — who is signed in.
 *
 * Returns `account: null` rather than a 401 when nobody is signed in, so the
 * client can branch on it without treating an anonymous visit as an error.
 */
export const GET = route(async () => {
  const account = await currentAccount();
  return ok({
    signedIn: account !== null,
    account: account ? publicAccount(account) : null,
  });
}, "GET /api/auth/session");
