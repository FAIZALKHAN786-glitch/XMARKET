import { z } from "zod";
import { ApiError, ok, rateLimit, route } from "@/lib/server/http";
import {
  AccountError,
  createBuyer,
  createSeller,
  publicAccount,
} from "@/lib/server/accounts";
import { writeSession } from "@/lib/server/session";
import { categoryId } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buyerSchema = z.object({
  role: z.literal("buyer"),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional(),
});

const sellerSchema = z.object({
  role: z.literal("seller"),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  merchantName: z.string().trim().min(2).max(160),
  shopName: z.string().trim().min(2).max(160),
  domain: categoryId,
});

/**
 * POST /api/auth/register — create a buyer or a seller and sign them straight
 * in. Sellers receive a platform-issued merchant id in the response; they never
 * choose it, because the performance score hangs off it.
 */
export const POST = route(
  async (request: Request) => {
    rateLimit("auth:register", 10, 60_000);

    const body = await request.json().catch(() => null);
    const role = (body as { role?: string } | null)?.role;

    try {
      if (role === "seller") {
        const input = sellerSchema.parse(body);
        const account = await createSeller(input);
        await writeSession(account);
        return ok({ account: publicAccount(account), merchantId: account.merchantId });
      }

      const input = buyerSchema.parse(body);
      const account = await createBuyer(input);
      await writeSession(account);
      return ok({ account: publicAccount(account) });
    } catch (error) {
      if (error instanceof AccountError) {
        throw new ApiError("conflict", error.message);
      }
      throw error;
    }
  },
  "POST /api/auth/register"
);
