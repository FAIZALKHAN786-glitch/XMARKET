import { ApiError, ok, readBody, route } from "@/lib/server/http";
import {
  getBuyer,
  getRequirement,
  incrementViews,
  listBidsForRequirement,
  listProviders,
  rank,
  setRequirementStatus,
} from "@/lib/server/repo";
import { requirementStatusPatch } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const requirement = await getRequirement(id);
  if (!requirement) throw new ApiError("not_found", `No requirement with id ${id}`);

  const [bids, providers, buyer] = await Promise.all([
    listBidsForRequirement(id),
    listProviders(),
    getBuyer(requirement.buyerId),
  ]);

  await incrementViews(id);

  return ok({ requirement, buyer, bids, ranked: rank(requirement, bids, providers) });
}, "GET /api/requirements/:id");

export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { status } = await readBody(request, requirementStatusPatch);
  const requirement = await setRequirementStatus(id, status);
  if (!requirement) throw new ApiError("not_found", `No requirement with id ${id}`);
  return ok({ requirement });
}, "PATCH /api/requirements/:id");
