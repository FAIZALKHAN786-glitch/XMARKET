import { ok, route } from "@/lib/server/http";
import { currentAccount } from "@/lib/server/session";
import { publicAccount } from "@/lib/server/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const account = await currentAccount();
  return ok({ account: account ? publicAccount(account) : null });
}, "GET /api/auth/session");
