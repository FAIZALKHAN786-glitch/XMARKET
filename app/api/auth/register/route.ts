import { ApiError, ok, readBody, route } from "@/lib/server/http";
import { writeSession } from "@/lib/server/session";
import { AccountError, createBuyer, createSeller, publicAccount } from "@/lib/server/accounts";
import { createProvider } from "@/lib/server/repo";
import { registerInput } from "@/lib/server/schema";
import { CATEGORY_LABELS } from "@/lib/xmarket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const input = await readBody(request, registerInput);

  let account;
  try {
    account =
      input.role === "seller"
        ? await createSeller({
            username: input.username,
            password: input.password,
            shopName: input.shopName!,
            shopLocation: input.shopLocation!,
            shopCategory: input.shopCategory!,
          })
        : await createBuyer({ username: input.username, password: input.password });
  } catch (error) {
    if (error instanceof AccountError) throw new ApiError("conflict", error.message);
    throw error;
  }

  // A seller needs a provider row before it can bid — the bid route looks the
  // merchant up by its XMarket ID.
  if (account.role === "seller") {
    await createProvider({
      id: account.xMarketId,
      name: account.shopName!,
      tagline: `${CATEGORY_LABELS[account.shopCategory!]} provider · ${account.shopLocation}`,
      location: account.shopLocation!,
      initials: account.shopName!.slice(0, 2).toUpperCase(),
      categories: [account.shopCategory!],
      skills: [CATEGORY_LABELS[account.shopCategory!], "Custom work"],
      rating: 5,
      reviews: 0,
      completedJobs: 0,
      onTimeRate: 100,
      responseHours: 4,
      verified: false,
      memberSince: new Date().getFullYear(),
    });
  }

  await writeSession(account);
  return ok({ account: publicAccount(account) }, { status: 201 });
}, "POST /api/auth/register");
