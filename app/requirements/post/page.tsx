"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { RequirementForm } from "@/components/requirement-form";
import { Badge, Card } from "@/components/ui";

export default function PostRequirementPage() {
  const { account, loading } = useSession();
  const router = useRouter();
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!account) router.replace("/login?next=/requirements/post");
    else if (account.role !== "buyer") router.replace("/seller-dashboard");
  }, [account, loading, router]);

  if (loading || !account || account.role !== "buyer") {
    return <div className="loading">Preparing the requirement form…</div>;
  }

  return (
    <div>
      <SiteHeader active="post" />
      <main className="narrow-frame fade-up">
        <Link href="/buyer-dashboard" className="eyebrow hover:underline inline-block">← Back to dashboard</Link>
        <div className="flex items-start justify-between gap-4 mt-4">
          <div>
            <h1 className="page-title">Post a new requirement</h1>
            <p className="lede">
              Tell providers what you need. The AI-style formatter can turn rough notes into a structured brief.
            </p>
          </div>
          <Badge tone="accent" className="hidden sm:inline-flex">Buyer only</Badge>
        </div>

        {posted ? (
          <Card className="mt-8 text-center py-12">
            <p className="eyebrow">Requirement live</p>
            <h2 className="section-heading">Your brief is in the marketplace</h2>
            <p className="lede mx-auto">Providers can now submit offers. Ranked bids will appear on your dashboard.</p>
            <div className="flex gap-3 justify-center mt-6 flex-wrap">
              <Link href="/buyer-dashboard" className="btn btn-primary">Go to dashboard →</Link>
              <button type="button" className="btn btn-outline" onClick={() => setPosted(false)}>Post another</button>
            </div>
          </Card>
        ) : (
          <RequirementForm onSuccess={() => setPosted(true)} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
