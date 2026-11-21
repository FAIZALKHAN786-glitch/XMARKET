import { ok, route } from "@/lib/server/http";
import { listProviders } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const providers = await listProviders();
  return ok({ providers });
}, "GET /api/providers");
