"use client";

import * as React from "react";
import {
  ArrowDownUp,
  Bookmark,
  Compass,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/data";
import { usd } from "@/lib/format";
import { daysUntil } from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { CategoryId } from "@/lib/types";
import { CategoryIcon } from "./icons";
import { RequirementCard } from "./requirement-card";
import { PageHeader } from "./nav";
import { Button, ButtonLink, EmptyState, Segmented } from "./ui/primitives";

type SortKey = "newest" | "closing" | "budget" | "offers";

const BUDGET_BANDS = [
  { id: "any", label: "Any budget", min: 0, max: Infinity },
  { id: "u50", label: "Under $50k", min: 0, max: 50_000 },
  { id: "50to150", label: "$50k – $150k", min: 50_000, max: 150_000 },
  { id: "150plus", label: "$150k+", min: 150_000, max: Infinity },
];

export function MarketExplorer() {
  const { requirements, bids, saved, role, meBuyerId } = useStore();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryId | "all">("all");
  const [band, setBand] = React.useState("any");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [closingSoon, setClosingSoon] = React.useState(false);
  const [savedOnly, setSavedOnly] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);

  const bidCount = (id: string) => bids.filter((b) => b.requirementId === id).length;

  const filtered = React.useMemo(() => {
    const activeBand = BUDGET_BANDS.find((b) => b.id === band)!;
    const q = query.trim().toLowerCase();

    const list = requirements.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (r.budgetMax < activeBand.min || r.budgetMax > activeBand.max) return false;
      if (closingSoon && daysUntil(r.closesAt) > 7) return false;
      if (savedOnly && !saved.includes(r.id)) return false;
      if (role === "provider" && r.status === "closed") return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.location.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    switch (sort) {
      case "closing":
        sorted.sort(
          (a, b) => +new Date(a.closesAt) - +new Date(b.closesAt)
        );
        break;
      case "budget":
        sorted.sort((a, b) => b.budgetMax - a.budgetMax);
        break;
      case "offers":
        sorted.sort((a, b) => bidCount(b.id) - bidCount(a.id));
        break;
      default:
        sorted.sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt));
    }
    return sorted;
  }, [
    requirements,
    category,
    band,
    query,
    sort,
    closingSoon,
    savedOnly,
    saved,
    role,
    bids,
  ]);

  const mine = requirements.filter((r) => r.buyerId === meBuyerId).length;
  const activeFilters =
    (category !== "all" ? 1 : 0) +
    (band !== "any" ? 1 : 0) +
    (closingSoon ? 1 : 0) +
    (savedOnly ? 1 : 0);

  const clearAll = () => {
    setCategory("all");
    setBand("any");
    setClosingSoon(false);
    setSavedOnly(false);
    setQuery("");
  };

  return (
    <div className="frame pt-10 md:pt-14">
      <PageHeader
        eyebrow={role === "buyer" ? "Marketplace feed" : "Opportunity feed"}
        title={
          role === "buyer"
            ? "See what others are procuring right now"
            : "Open requirements matched to your capabilities"
        }
        body={
          role === "buyer"
            ? "Every listing is a real requirement with a budget ceiling and deadline. Post your own and let providers come to you."
            : "Filter by category, budget band and urgency, then pitch with a milestone plan the buyer can actually evaluate."
        }
        actions={
          <>
            <ButtonLink href="/post">
              <Plus className="size-4" />
              Post a requirement
            </ButtonLink>
            <ButtonLink href="/compare" variant="outline">
              Comparison view
            </ButtonLink>
          </>
        }
      />

      {/* ------------------------------------------------------- toolbar */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search specs, tags, locations — e.g. “CNC”, “cold chain”, “Next.js”"
              className="field h-11 pl-9"
              aria-label="Search requirements"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={sort}
              onChange={setSort}
              options={[
                { value: "newest", label: "Newest" },
                { value: "closing", label: "Closing soon" },
                { value: "budget", label: "Budget" },
                { value: "offers", label: "Most offers" },
              ]}
            />
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters((v) => !v)}
              className="lg:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {activeFilters > 0 && (
                <span className="num rounded-full bg-white px-1.5 text-[0.625rem] text-white">
                  {activeFilters}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* category rail */}
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            All categories
          </CategoryChip>
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              onClick={() =>
                setCategory((prev) => (prev === c.id ? "all" : c.id))
              }
            >
              <CategoryIcon category={c.id} className="size-3.5" />
              {c.label}
            </CategoryChip>
          ))}
        </div>

        {/* advanced filters */}
        <div
          className={cn(
            "surface-flat grid gap-5 p-4 sm:grid-cols-2 lg:grid-cols-4",
            !showFilters && "hidden lg:grid"
          )}
        >
          <div>
            <span className="label">Budget band</span>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_BANDS.map((b) => (
                <Toggle
                  key={b.id}
                  active={band === b.id}
                  onClick={() => setBand(b.id)}
                >
                  {b.label}
                </Toggle>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Urgency</span>
            <div className="flex flex-wrap gap-1.5">
              <Toggle
                active={closingSoon}
                onClick={() => setClosingSoon((v) => !v)}
                aria-pressed={closingSoon}
              >
                Closing in 7 days
              </Toggle>
              <Toggle
                active={savedOnly}
                onClick={() => setSavedOnly((v) => !v)}
              >
                <Bookmark className="size-3" />
                Saved only
              </Toggle>
            </div>
          </div>

          <div>
            <span className="label">Sort by</span>
            <div className="relative">
              <ArrowDownUp className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/35" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="field h-10 appearance-none pl-9"
                aria-label="Sort results"
              >
                <option value="newest">Newest first</option>
                <option value="closing">Closing soonest</option>
                <option value="budget">Largest budget</option>
                <option value="offers">Most offers</option>
              </select>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="text-xs muted">
              <p className="num text-lg font-semibold text-white">
                {filtered.length}
              </p>
              <p>
                of {requirements.length} requirements
                {mine > 0 && <> · {mine} yours</>}
              </p>
            </div>
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" onClick={clearAll}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- results */}
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="text-[0.9375rem] font-semibold text-white">
          {filtered.length} open requirement
          {filtered.length === 1 ? "" : "s"}
        </h2>
        <p className="hidden text-xs faint sm:block">
          Sorted by{" "}
          {sort === "newest"
            ? "newest"
            : sort === "closing"
              ? "closing date"
              : sort === "budget"
                ? "budget ceiling"
                : "offer volume"}
        </p>
      </div>

      <div className="mt-5 pb-10">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Compass className="size-5" />}
            title="No requirements match those filters"
            body="Try widening the budget band, clearing the search, or switching category."
            action={
              <Button variant="outline" onClick={clearAll}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <RequirementCard
                key={r.id}
                requirement={r}
                bidCount={bidCount(r.id)}
              />
            ))}
          </div>
        )}
        {filtered.length > 0 && role === "provider" && (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center text-[0.8125rem] muted">
            Average winning bid on XMARKET lands{" "}
            <span className="font-semibold text-white">
              {usd(6800, { compact: true })}
            </span>{" "}
            under the buyer&rsquo;s ceiling — and 4 days faster than the
            deadline.
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.75rem] font-medium transition",
        active
          ? "border-white/45/50 bg-white/18 text-white"
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-medium transition",
        active
          ? "border-white/30/45 bg-white/70/12 text-white/75"
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
