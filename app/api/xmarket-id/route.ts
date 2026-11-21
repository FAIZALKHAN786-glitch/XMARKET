import { ok, route } from "@/lib/server/http";
import { requireAccount } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const account = await requireAccount();
  return ok({
    xMarketId: account.xMarketId,
    role: account.role,
    shareUrl: `/id/${account.xMarketId}`,
  });
}, "GET /api/xmarket-id");
