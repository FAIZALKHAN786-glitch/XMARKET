import { z } from "zod";
import { ApiError, ok, rateLimit, readBody, route } from "@/lib/server/http";
import { findByEmail, publicAccount, verifyPassword } from "@/lib/server/accounts";
import { writeSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  /**
   * Optional. When the caller states a role we enforce it, so a seller cannot
   * sign in through the buyer form and land on the wrong page.
   */
  role: z.enum(["buyer", "seller"]).optional(),
});

/** POST /api/auth/login */
export const POST = route(
  async (request: Request) => {
    rateLimit("auth:login", 20, 60_000);
    const input = await readBody(request, loginSchema);

    const account = await findByEmail(input.email);
    // Same message whether the email is unknown or the password is wrong —
    // otherwise this endpoint becomes an email enumerator.
    const invalid = new ApiError("auth", "Email or password is incorrect.");

    if (!account) throw invalid;
    if (input.role && account.role !== input.role) throw invalid;
    if (!(await verifyPassword(account, input.password))) throw invalid;

    await writeSession(account);
    return ok({
      account: publicAccount(account),
      merchantId: account.merchantId,
    });
  },
  "POST /api/auth/login"
);
