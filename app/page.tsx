"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Badge, ScoreBar } from "@/components/ui";

const PREVIEW = [
  { rank: 1, name: "Atlas Precision", price: "$74,200", score: 94, top: true },
  { rank: 2, name: "Kestrel Systems", price: "$88,300", score: 87 },
  { rank: 3, name: "Voltaic Assembly", price: "$61,800", score: 79 },
];

export default function Hero() {
  const { account, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading || !account) return;
    router.replace(account.role === "seller" ? "/seller-dashboard" : "/buyer-dashboard");
  }, [account, loading, router]);

  if (loading) return <div className="loading">Loading X Market…</div>;

  return (
    <div>
      <SiteHeader />
      <section className="hero">
        <div className="hero-inner">
          <div className="fade-up">
            <Badge tone="accent" className="preview-badge">THE REVERSE MARKETPLACE</Badge>
            <h1 className="display">
              X Market<em>.</em>
            </h1>
            <p className="hero-slogan">
              Connecting buyers with trusted providers. Post what you need, compare ranked bids,
              and close the deal with one portable XMarket ID.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary btn-lg" href="/login?next=/requirements/post">
                Get Started — Post Your First Requirement <span aria-hidden="true">→</span>
              </Link>
              <Link className="btn btn-outline btn-lg" href="/login?mode=register">
                Create Account
              </Link>
            </div>
            <div className="hero-proof">
              <span><b>No listing fees</b> for buyers</span>
              <span><b>ML-style scoring</b> on every bid</span>
              <span><b>4 novelty features</b> on one ID</span>
            </div>
          </div>

          <div className="preview-stack delay-2" aria-label="Example recommendations">
            <div className="surface">
              <p className="eyebrow">Recommended bids · live demo data</p>
              <div className="flex items-center justify-between gap-3 mb-5">
                <p className="card-title mb-0">Precision aluminium housings</p>
                <Badge tone="good">A · Top match</Badge>
              </div>
              {PREVIEW.map((row) => (
                <div className="preview-row" key={row.name}>
                  <span className={`preview-rank ${row.top ? "top" : ""}`}>{row.rank}</span>
                  <div className="min-w-0">
                    <p className="preview-name truncate">{row.name}</p>
                    <ScoreBar score={row.score} />
                  </div>
                  <span className="preview-price num">{row.price}</span>
                </div>
              ))}
            </div>
            <div className="surface-dark flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow id-eyebrow">Your digital business card</p>
                <p className="num font-semibold" style={{ margin: 0 }}>XM-BUYER-A3F9K2</p>
              </div>
              <span className="id-orb" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="stat-strip">
          <div className="strip-item">
            <p className="strip-value num">10k+</p>
            <p className="strip-label">Requirements posted</p>
          </div>
          <div className="strip-item">
            <p className="strip-value num">1M+</p>
            <p className="strip-label">Bids submitted</p>
          </div>
          <div className="strip-item">
            <p className="strip-value num">98%</p>
            <p className="strip-label">Match accuracy</p>
          </div>
        </div>
      </section>

      <section className="page-frame">
        <div className="section-title">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="section-heading">From requirement to award in four steps</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["01", "Post a requirement", "Describe the work, set a target budget and a deadline. Our formatter turns rough notes into a clean brief."],
            ["02", "Compare ranked bids", "Every offer is scored on budget, timeline and relevance — with the reasoning shown, not hidden."],
            ["03", "Award with confidence", "Accept a bid and the XMarket ID tracks escrow-style milestones from hold to release."],
            ["04", "Build your trail", "Bids, deals and ratings follow your ID across projects as a portable reputation."],
          ].map(([n, title, body]) => (
            <div className="surface" key={n}>
              <p className="num eyebrow">{n}</p>
              <p className="card-title">{title}</p>
              <p className="text-[13px] leading-relaxed text-[#55554f] m-0">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
