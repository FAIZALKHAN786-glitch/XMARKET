import { z } from "zod";
import { ok, rateLimit, readBody, route } from "@/lib/server/http";
import { createResetToken } from "@/lib/server/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email().max(200) });

/**
 * POST /api/auth/request-reset
 *
 * Returns the same response whether or not the address exists, so this cannot
 * be used to discover who is registered.
 *
 * There is no mail transport in this project yet, so the token is returned in
 * the response for development. Wiring up email means deleting `devToken` from
 * this response and putting it in the message instead — nothing else changes.
 */
export const POST = route(
  async (request: Request) => {
    rateLimit("auth:request-reset", 5, 60_000);
    const input = await readBody(request, schema);
    const token = await createResetToken(input.email);
    return ok({
      requested: true,
      message: "If that address is registered, a reset link has been sent.",
      devToken: token,
    });
  },
  "POST /api/auth/request-reset"
);
