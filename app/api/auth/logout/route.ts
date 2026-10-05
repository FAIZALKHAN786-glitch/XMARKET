import { ok, route } from "@/lib/server/http";
import { clearSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/logout */
export const POST = route(async () => {
  await clearSession();
  return ok({ signedOut: true });
}, "POST /api/auth/logout");
