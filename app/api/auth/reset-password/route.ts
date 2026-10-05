import { z } from "zod";
import { ApiError, ok, rateLimit, readBody, route } from "@/lib/server/http";
import { consumeResetToken, updatePassword } from "@/lib/server/accounts";
import { revokeAllFor } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(16).max(200),
  newPassword: z.string().min(8).max(200),
});

/** POST /api/auth/reset-password — consume a token and set a new password. */
export const POST = route(
  async (request: Request) => {
    rateLimit("auth:reset-password", 10, 60_000);
    const input = await readBody(request, schema);

    // Single use and time-limited; consumeResetToken atomically marks it used,
    // so replaying the same token cannot set the password twice.
    const accountId = await consumeResetToken(input.token);
    if (!accountId) {
      throw new ApiError("auth", "That reset link is invalid or has expired.");
    }

    await updatePassword(accountId, input.newPassword);
    await revokeAllFor(accountId);
    return ok({ reset: true, sessionsRevoked: true });
  },
  "POST /api/auth/reset-password"
);
