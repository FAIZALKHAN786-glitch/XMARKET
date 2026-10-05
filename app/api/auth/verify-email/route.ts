import { z } from "zod";
import { ApiError, ok, rateLimit, readBody, route } from "@/lib/server/http";
import { consumeVerificationToken } from "@/lib/server/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(16).max(200) });

/** POST /api/auth/verify-email — consume a token and verify the address. */
export const POST = route(
  async (request: Request) => {
    rateLimit("auth:verify", 10, 60_000);
    const input = await readBody(request, schema);

    // Marked used inside the same UPDATE that selects it, so a replay cannot
    // verify twice.
    const accountId = await consumeVerificationToken(input.token);
    if (!accountId) {
      throw new ApiError("auth", "That verification link is invalid or has expired.");
    }
    return ok({ verified: true });
  },
  "POST /api/auth/verify-email"
);
