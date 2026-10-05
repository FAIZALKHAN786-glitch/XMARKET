import { z } from "zod";
import { ok, rateLimit, readBody, route } from "@/lib/server/http";
import { createVerificationToken } from "@/lib/server/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email().max(200) });

/**
 * POST /api/auth/request-verification
 *
 * Identical response for a registered address and an unknown one, so this
 * cannot be used to discover who has an account. The token is returned as
 * devToken only because no mail transport exists yet.
 */
export const POST = route(
  async (request: Request) => {
    rateLimit("auth:verify-request", 5, 60_000);
    const input = await readBody(request, schema);
    const token = await createVerificationToken(input.email);
    return ok({
      requested: true,
      message: "If that address is registered, a verification link has been sent.",
      devToken: token,
    });
  },
  "POST /api/auth/request-verification"
);
