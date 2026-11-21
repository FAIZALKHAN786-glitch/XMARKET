import Link from "next/link";
import { notFound } from "next/navigation";
import { findByXMarketId } from "@/lib/server/accounts";
import { listBids, listProviders, listRequirements } from "@/lib/server/repo";
import { Badge, CopyButton } from "@/components/ui";
import { CATEGORY_LABELS, money, providerXMarketId } from "@/lib/xmarket";

export const dynamic = "force-dynamic";

export default async function PublicIdPage({ params }: { params: Promise<{ xmarketId: string }> }) {
  const { xmarketId } = await params;
  const account = await findByXMarketId(decodeURIComponent(xmarketId));
  if (!account) notFound();

  const [bids, requirements, providers] = await Promise.all([
    listBids(), listRequirements(), listProviders(),
  ]);
  const mine = account.role === "seller"
    ? bids.filter((b) => b.providerId === account.xMarketId)
    : bids.filter((b) => requirements.some((r) => r.buyerId === account.id && r.id === b.requirementId));
  const wins = mine.filter((b) => b.status === "accepted");
  const positive = account.role === "seller" ? 90 + Math.min(9, wins.length * 3) : 98;

  return (
    <div>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">×</span> X Market</Link>
          <div className="header-actions ml-auto"><span className="chip">Read-only public card</span></div>
        </div>
      </header>
      <main className="narrow-frame fade-up">
        <p className="eyebrow">Digital business card · Novelty 01</p>
        <div className="surface-dark p-8 mt-4">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <Badge tone="accent" className="mb-4">{account.role.toUpperCase()}</Badge>
              <p className="num text-2xl sm:text-3xl font-semibold break-all m-0">{account.xMarketId}</p>
              <p className="text-sm mt-3 mb-0" style={{ color: "rgba(255,255,255,.6)" }}>
                {account.shopName ?? account.displayName} · {account.shopLocation ?? "X Market member"}
              </p>
            </div>
            <span className="id-orb" aria-hidden="true" />
          </div>
          <p className="mt-6 text-sm m-0" style={{ color: "rgba(255,255,255,.6)" }}>
            Shareable link: xmarket.com/id/{account.xMarketId}
          </p>
          <div className="id-actions">
            <CopyButton value={account.xMarketId} label="Copy ID" />
            <CopyButton value={`https://xmarket.com/id/${account.xMarketId}`} label="Copy share link" />
          </div>
        </div>

        <div className="section-title">
          <div>
            <p className="eyebrow">Reputation trail</p>
            <h2 className="section-heading">Activity attached to this ID</h2>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><p className="eyebrow">Bids</p><p className="num stat-value">{mine.length}</p></div>
          <div className="stat-card"><p className="eyebrow">Accepted</p><p className="num stat-value">{wins.length}</p></div>
          <div className="stat-card"><p className="eyebrow">Positive feedback</p><p className="num stat-value">{positive}%</p></div>
        </div>

        <div className="surface mt-5">
          <p className="eyebrow">Recent activity</p>
          {mine.length === 0 ? (
            <p className="text-sm text-[#8a8a82] m-0">No recorded activity yet.</p>
          ) : (
            mine.slice(0, 6).map((bid) => {
              const req = requirements.find((r) => r.id === bid.requirementId);
              const provider = providers.find((p) => p.id === bid.providerId);
              return (
                <div className="card-link" key={bid.id}>
                  <div className="min-w-0">
                    <p className="card-title truncate text-[13px]">{req?.title ?? "Requirement"}</p>
                    <p className="card-meta">
                      <span>{account.role === "seller" ? account.xMarketId : providerXMarketId(bid.providerId, provider?.categories[0])}</span>
                      <span className="capitalize">{bid.status}</span>
                    </p>
                  </div>
                  <span className="num font-semibold text-sm">{money(bid.price)}</span>
                </div>
              );
            })
          )}
        </div>

        <p className="field-hint mt-6">
          {account.shopCategory ? `${CATEGORY_LABELS[account.shopCategory]} seller · ` : ""}
          This ID is portable across projects: reputation, escrow milestones and budget history stay with it.
        </p>
      </main>
    </div>
  );
}
