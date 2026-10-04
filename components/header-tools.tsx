"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Compass,
  CornerDownLeft,
  FileText,
  Gauge,
  LayoutDashboard,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/data";
import { rankBids } from "@/lib/engine";
import { usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CategoryIcon } from "./icons";
import { Avatar, TimeAgo } from "./ui/primitives";
import { ScorePill } from "./ui/score";

/* ---------------------------------------------------------------- palette */

export function SearchLauncher() {
  const router = useRouter();
  const { requirements, providers, bids, weights } = useStore();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();

  const pages = [
    { label: "Marketplace feed", href: "/market", icon: Compass },
    { label: "Post a requirement", href: "/post", icon: Plus },
    { label: "Comparison dashboard", href: "/compare", icon: Gauge },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Offers & bids", href: "/proposals", icon: FileText },
  ].filter((p) => !q || p.label.toLowerCase().includes(q));

  const matchedRequirements = requirements
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.location.toLowerCase().includes(q)
    )
    .slice(0, 5);

  const matchedProviders = providers
    .filter(
      (p) =>
        q &&
        (p.name.toLowerCase().includes(q) ||
          p.skills.some((s) => s.toLowerCase().includes(q)) ||
          p.tagline.toLowerCase().includes(q))
    )
    .slice(0, 3);

  const matchedCategories = CATEGORIES.filter(
    (c) => q && c.label.toLowerCase().includes(q)
  ).slice(0, 3);

  const bestScoreFor = (id: string) => {
    const requirement = requirements.find((r) => r.id === id)!;
    const ranked = rankBids(
      bids.filter((b) => b.requirementId === id),
      requirement,
      providers,
      weights
    );
    return ranked[0]?.score.total;
  };

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search XMARKET"
        className="hidden size-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/5 hover:text-white lg:grid"
      >
        <Search className="size-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
          <div
            className="fixed inset-0 bg-black/80"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="surface animate-rise relative w-full max-w-xl overflow-hidden shadow-2xl shadow-black"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="size-4 shrink-0 text-white/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search requirements, providers or pages…"
                className="h-14 w-full bg-transparent text-[0.9375rem] text-white placeholder:text-white/35 focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded-md border border-white/12 bg-white/5 px-1.5 py-0.5 font-mono text-[0.625rem] text-white/45 sm:block">
                esc
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {matchedCategories.length > 0 && (
                <Group label="Categories">
                  {matchedCategories.map((c) => (
                    <Item
                      key={c.id}
                      onClick={() => go("/market")}
                      icon={<CategoryIcon category={c.id} className="size-4" />}
                      title={c.label}
                      sub={c.blurb}
                    />
                  ))}
                </Group>
              )}

              {matchedRequirements.length > 0 && (
                <Group label={q ? "Requirements" : "Live requirements"}>
                  {matchedRequirements.map((r) => {
                    const best = bestScoreFor(r.id);
                    return (
                      <Item
                        key={r.id}
                        onClick={() => go(`/market/${r.id}`)}
                        icon={<CategoryIcon category={r.category} className="size-4" />}
                        title={r.title}
                        sub={`${usd(r.budgetMax, { compact: true })} ceiling · ${r.location}`}
                        trailing={
                          best !== undefined ? (
                            <ScorePill score={best} size="sm" />
                          ) : (
                            <span className="text-[0.6875rem] faint">no offers</span>
                          )
                        }
                      />
                    );
                  })}
                </Group>
              )}

              {matchedProviders.length > 0 && (
                <Group label="Providers">
                  {matchedProviders.map((p) => (
                    <Item
                      key={p.id}
                      onClick={() => go("/dashboard")}
                      icon={<Avatar initials={p.initials} size={22} seed={p.reviews} />}
                      title={p.name}
                      sub={`${p.rating.toFixed(1)}★ · ${p.onTimeRate}% on time · ${p.location}`}
                    />
                  ))}
                </Group>
              )}

              {pages.length > 0 && (
                <Group label="Go to">
                  {pages.map((p) => (
                    <Item
                      key={p.href}
                      onClick={() => go(p.href)}
                      icon={<p.icon className="size-4" />}
                      title={p.label}
                      trailing={<CornerDownLeft className="size-3.5 text-white/25" />}
                    />
                  ))}
                </Group>
              )}

              {pages.length === 0 &&
                matchedRequirements.length === 0 &&
                matchedProviders.length === 0 &&
                matchedCategories.length === 0 && (
                  <p className="p-6 text-center text-sm muted">
                    Nothing matched “{query}”. Try a material, a tag or a
                    category name.
                  </p>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-4 py-2.5 text-[0.6875rem] faint">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3 text-white/75" />
                Searches specs, tags, providers and pages
              </span>
              <span className="hidden sm:inline">
                ⌘K to open anywhere in the app
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-3 py-2 text-[0.625rem] font-bold tracking-[0.18em] text-white/35 uppercase">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Item({
  onClick,
  icon,
  title,
  sub,
  trailing,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-white">
          {title}
        </span>
        {sub && <span className="block truncate text-[0.6875rem] faint">{sub}</span>}
      </span>
      {trailing}
      <ArrowRight className="size-3.5 shrink-0 text-white/0 transition group-hover:text-white/40" />
    </button>
  );
}

/* ------------------------------------------------------------- bell menu */

export function NotificationBell() {
  const { bids, requirements, providers, meBuyerId, meProviderId, role } =
    useStore();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const items = React.useMemo(() => {
    if (role === "buyer") {
      return bids
        .filter((b) =>
          requirements.some(
            (r) => r.id === b.requirementId && r.buyerId === meBuyerId
          )
        )
        .sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
        )
        .slice(0, 5)
        .map((bid) => ({
          id: bid.id,
          title: `${
            providers.find((p) => p.id === bid.providerId)?.name ?? "A provider"
          } submitted ${usd(bid.price, { compact: true })}`,
          sub:
            requirements.find((r) => r.id === bid.requirementId)?.title ?? "",
          at: bid.createdAt,
        }));
    }
    return bids
      .filter((b) => b.providerId === meProviderId)
      .slice(0, 5)
      .map((bid) => ({
        id: bid.id,
        title: `Your bid was ${bid.status}`,
        sub: requirements.find((r) => r.id === bid.requirementId)?.title ?? "",
        at: bid.createdAt,
      }));
  }, [bids, requirements, providers, role, meBuyerId, meProviderId]);

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className={cn(
          "relative grid size-9 place-items-center rounded-lg transition hover:bg-white/5 hover:text-white",
          open ? "bg-white/5 text-white" : "text-white/55"
        )}
      >
        <Bell className="size-4" />
        {items.length > 0 && (
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-white/70" />
        )}
      </button>

      {open && (
        <div className="surface animate-rise absolute top-11 right-0 w-80 overflow-hidden p-0 shadow-2xl shadow-black">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-[0.8125rem] font-semibold text-white">
              Activity
            </p>
            <span className="inline-flex items-center gap-1 text-[0.625rem] text-white/75">
              <span className="size-1.5 rounded-full bg-white/70 animate-pulse-soft" />
              live
            </span>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setOpen(false)}
                  className="flex w-full items-start gap-3 border-b border-white/6 px-4 py-3 text-left transition last:border-0 hover:bg-white/5"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/15 text-white/75">
                    {role === "buyer" ? (
                      <Users className="size-3.5" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] text-white/90">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.6875rem] faint">
                      {item.sub}
                    </span>
                    <span className="mt-1 block text-[0.625rem] faint">
                      <TimeAgo iso={item.at} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs faint">
                Nothing yet. Activity appears here as offers move.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
