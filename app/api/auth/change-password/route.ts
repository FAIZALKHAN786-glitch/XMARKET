import { z } from "zod";
import { ApiError, ok, rateLimit, readBody, route } from "@/lib/server/http";
import { updatePassword, verifyPassword } from "@/lib/server/accounts";
import { currentAccount } from "@/lib/server/session";
import { revokeAllFor } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

/** POST /api/auth/change-password — signed-in password change. */
export const POST = route(
  async (request: Request) => {
    rateLimit("auth:change-password", 10, 60_000);
    const account = await currentAccount();
    if (!account) throw new ApiError("auth", "You need to sign in to do that.");

    const input = await readBody(request, schema);
    if (!(await verifyPassword(account, input.currentPassword))) {
      throw new ApiError("auth", "Your current password is incorrect.");
    }
    if (input.currentPassword === input.newPassword) {
      throw new ApiError("bad_request", "The new password must be different.");
    }

    await updatePassword(account.id, input.newPassword);
    // A password change is exactly when every other device should be logged out.
    await revokeAllFor(account.id);
    return ok({ changed: true, sessionsRevoked: true });
  },
  "POST /api/auth/change-password"
);
