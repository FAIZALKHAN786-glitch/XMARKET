import { ok, route } from "@/lib/server/http";
import { listBids, listBuyers, listEvents, listProviders, listRequirements } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One round trip for the client store. The app is small enough that a single
 * bootstrap payload beats a dozen requests on first paint, and it keeps the
 * client state machine simple.
 */
export const GET = route(async () => {
  const [requirements, bids, providers, buyers, events] = await Promise.all([
    listRequirements(),
    listBids(),
    listProviders(),
    listBuyers(),
    listEvents(25),
  ]);

  return ok({
    requirements,
    bids,
    providers,
    buyers,
    events,
    serverTime: new Date().toISOString(),
  });
}, "GET /api/bootstrap");
