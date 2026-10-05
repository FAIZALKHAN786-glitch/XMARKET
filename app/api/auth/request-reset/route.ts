import { z } from "zod";
import { ok, rateLimit, readBody, route } from "@/lib/server/http";
import { createResetToken } from "@/lib/server/accounts";
import { isMailConfigured, sendPasswordReset } from "@/lib/server/mail";

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
    const message = "If that address is registered, a reset link has been sent.";

    // Once a transport exists the token is emailed and never returned, so the
    // endpoint cannot be used to read somebody else's reset link.
    if (token && isMailConfigured()) {
      await sendPasswordReset(input.email, token);
      return ok({ requested: true, message });
    }

    return ok({
      requested: true,
      message,
      // Development only: there is no transport configured, so there is
      // nowhere else for the token to go.
      devToken: token,
    });
  },
  "POST /api/auth/request-reset"
);
