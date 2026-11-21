"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Badge, Card, CategorySelect, EmptyState, Input, SectionTitle } from "@/components/ui";
import { CATEGORY_LABELS, money } from "@/lib/xmarket";

type Requirement = {
  id: string; title: string; summary: string; description: string; category: string; budgetMax: number;
  budgetTarget: number; location: string; closesAt: string; deadline: string;
  tags: string[]; status: string; views: number;
};

export default function BrowsePage() {
  const [rows, setRows] = useState<Requirement[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    fetch(`/api/requirements?${params}`)
      .then((r) => r.json())
      .then((body) => setRows(body?.data?.requirements ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [query, category]);

  return (
    <div>
      <SiteHeader active="browse" />
      <main className="page-frame fade-up">
        <div className="mb-6">
          <p className="eyebrow">Marketplace</p>
          <h1 className="page-title">Browse requirements</h1>
          <p className="lede">Open work from buyers, with budgets and deadlines up front.</p>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <Input className="max-w-sm" placeholder="Search by title, tag or location…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search requirements" />
          <div className="w-full sm:w-64"><CategorySelect value={category} onChange={setCategory} includeAll /></div>
        </div>

        <SectionTitle eyebrow={`${rows.length} opportunities`} title="Live requirements" />
        {loading ? (
          <p className="text-sm text-[#8a8a82]">Loading requirements…</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No requirements found" body="Try a different search or category — new work is posted every day." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rows.map((r) => (
              <Link href={`/requirements/${r.id}`} key={r.id} className="surface block hover:border-[#0b0b0b] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <Badge tone={r.status === "reviewing" ? "warn" : "neutral"}>
                    {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category}
                  </Badge>
                  <span className="num text-sm font-semibold">{money(r.budgetMax)}</span>
                </div>
                <p className="card-title mt-4">{r.title}</p>
                <p className="text-[13px] text-[#55554f] leading-relaxed line-clamp-2 m-0">{r.summary || r.description}</p>
                <div className="card-meta mt-4">
                  <span>{r.location}</span>
                  <span>Target {money(r.budgetTarget)}</span>
                  <span className="capitalize">{r.status}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {r.tags?.slice(0, 3).map((t) => <span className="chip" key={t}>{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
