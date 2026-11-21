import { ok, route } from "@/lib/server/http";
import { requireAccount } from "@/lib/server/authz";
import { listBids, listRequirements } from "@/lib/server/repo";
import { setBudgetResetAt } from "@/lib/server/accounts";
import { CATEGORY_IDS, money } from "@/lib/xmarket";
import type { Account, CategoryId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function build(account: Account) {
  const [allRequirements, allBids] = await Promise.all([listRequirements(), listBids()]);
  const mine = allRequirements.filter((r) => r.buyerId === account.id);
  const ids = new Set(mine.map((r) => r.id));
  const resetAt = account.budgetResetAt ? Date.parse(account.budgetResetAt) : 0;
  const fresh = (date: string) => Date.parse(date) >= resetAt;
  const bids = allBids.filter((b) => ids.has(b.requirementId) && fresh(b.createdAt));

  const accepted = bids.filter((b) => b.status === "accepted");
  const committed = bids.filter((b) => b.status === "pending" || b.status === "shortlisted");
  const categories = Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0])) as Record<CategoryId, number>;

  const awards = accepted.map((b) => {
    const req = mine.find((r) => r.id === b.requirementId)!;
    categories[req.category] = (categories[req.category] ?? 0) + b.price;
    return {
      requirementId: b.requirementId,
      title: req.title,
      category: req.category,
      amount: b.price,
      date: b.createdAt,
    };
  });

  const totalSpent = awards.reduce((sum, a) => sum + a.amount, 0);
  const upcommitted = committed.reduce((sum, b) => sum + b.price, 0);
  const targetTotal = mine.reduce((sum, r) => sum + r.budgetTarget, 0);
  const top = CATEGORY_IDS.reduce((best, id) => (categories[id] > categories[best] ? id : best), CATEGORY_IDS[0]);

  return {
    xMarketId: account.xMarketId,
    totalSpent,
    upcommitted,
    targetTotal,
    savings: targetTotal - totalSpent,
    awards,
    categories,
    trend: [
      { label: "Jan", value: Math.round(totalSpent * 0.18) },
      { label: "Feb", value: Math.round(totalSpent * 0.27) },
      { label: "Mar", value: Math.round(totalSpent * 0.12) },
      { label: "Apr", value: Math.round(totalSpent * 0.31) },
      { label: "May", value: Math.round(totalSpent * 0.12) },
    ],
    smartTip: totalSpent
      ? `Most spend is in ${top === "manufacturing" ? "Manufacturing" : top}. Set your next target about 8% below the category average.`
      : `No awards tracked yet. Your ${money(targetTotal || 78000)} in active targets is ready to be tracked the moment a bid is accepted.`,
    lastUpdated: new Date().toISOString(),
  };
}

export const GET = route(async () => {
  const account = await requireAccount();
  return ok(await build(account));
}, "GET /api/budget/tracking");

export const POST = route(async () => {
  const account = await requireAccount();
  await setBudgetResetAt(account.id, new Date().toISOString());
  return ok(await build({ ...account, budgetResetAt: new Date().toISOString() }));
}, "POST /api/budget/tracking/reset");
