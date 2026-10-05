"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  FileText,
  Gauge,
  LayoutDashboard,
  Menu,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { Logo } from "./brand";
import { NotificationBell, SearchLauncher } from "./header-tools";
import { LogOut } from "lucide-react";
import { OfflineBanner, SystemStatus } from "./system-status";
import { Avatar, ButtonLink, Segmented } from "./ui/primitives";

const BUYER_NAV = [
  { href: "/market", label: "Marketplace", icon: Compass },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compare", label: "Compare", icon: Gauge },
];

const PROVIDER_NAV = [
  { href: "/market", label: "Opportunities", icon: Compass },
  { href: "/proposals", label: "My bids", icon: Send },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function RoleSwitch({ className }: { className?: string }) {
  const { role, setRole, account } = useStore();
  // Signed in, the role comes from the account and cannot be toggled — so this
  // slot becomes the way out instead.
  if (account) {
    return (
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/signin";
        }}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-[0.8125rem] text-white/70 transition-colors duration-150 hover:border-white/40 hover:text-white",
          className
        )}
      >
        <LogOut className="size-3.5" />
        Sign out
      </button>
    );
  }

  return (
    <Segmented
      size="sm"
      className={className}
      value={role}
      onChange={(v) => setRole(v)}
      options={[
        { value: "buyer", label: "Buyer" },
        { value: "provider", label: "Provider" },
      ]}
    />
  );
}

function RoleHint() {
  const { role } = useStore();
  return (
    <span className="hidden items-center gap-1.5 text-[0.6875rem] text-white/40 lg:inline-flex">
      <Sparkles className="size-3" />
      {role === "buyer"
        ? "posting needs & comparing offers"
        : "bidding on open needs"}
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { role, meBuyerId, meProviderId, buyers, providers } = useStore();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  const me =
    role === "buyer"
      ? buyers.find((b) => b.id === meBuyerId)
      : providers.find((p) => p.id === meProviderId);

  const links = role === "buyer" ? BUYER_NAV : PROVIDER_NAV;

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled ? "border-white/10 bg-ink-950/90" : "border-transparent"
      )}
    >
      <OfflineBanner />
      <div className="frame flex h-16 items-center gap-3">
        <Logo />

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition",
                  active
                    ? "bg-white/5 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <link.icon className="size-3.5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <RoleHint />
          <RoleSwitch className="hidden sm:inline-flex" />

          <SystemStatus className="hidden md:block" />
          <SearchLauncher />
          <NotificationBell />

          <span className="hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-1.5 pr-3 pl-1.5 lg:inline-flex">
            <Avatar initials={me?.initials ?? "??"} size={26} seed={3} />
            <span className="text-[0.8125rem] font-medium text-white/85">
              {"company" in (me ?? {})
                ? (me as { company: string }).company
                : (me as { name: string })?.name}
            </span>
          </span>

          <ButtonLink
            href="/post"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Plus className="size-3.5" />
            {role === "buyer" ? "Post a need" : "Find work"}
          </ButtonLink>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="grid size-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/5 md:hidden"
          >
            {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink-950 md:hidden">
          <div className="frame flex flex-col gap-1 py-4">
            <RoleSwitch className="mb-2 self-start" />
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/5"
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            ))}
            <ButtonLink href="/post" className="mt-2">
              <Plus className="size-4" />
              {role === "buyer" ? "Post a need" : "Find work"}
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { role } = useStore();
  const links = (role === "buyer" ? BUYER_NAV : PROVIDER_NAV).slice(0, 3);
  // Four fixed slots: two primary destinations, then Post and Offers. The
  // primary pair has to skip those two hrefs — PROVIDER_NAV already lists
  // /proposals second, so taking links[0] and links[1] verbatim put the same
  // href in two slots and React warned about the duplicate key. The tab grid
  // is grid-cols-4, so this must yield exactly four distinct destinations.
  const pinned = ["/post", "/proposals"];
  const all = [
    ...links.filter((link) => !pinned.includes(link.href)).slice(0, 2),
    { href: "/post", label: role === "buyer" ? "Post" : "Bid", icon: Plus },
    { href: "/proposals", label: "Offers", icon: FileText },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950 sm:hidden">
      <div className="grid grid-cols-4">
        {all.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.625rem] font-medium transition",
                active ? "text-white/75" : "text-white/50"
              )}
            >
              <link.icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SiteFooter() {
  const groups = [
    {
      title: "Product",
      links: [
        { label: "Marketplace", href: "/market" },
        { label: "Post a need", href: "/post" },
        { label: "Comparison", href: "/compare" },
        { label: "Dashboard", href: "/dashboard" },
      ],
    },
    {
      title: "For providers",
      links: [
        { label: "Opportunities", href: "/market" },
        { label: "Submit a bid", href: "/proposals" },
        { label: "Scoring engine", href: "/#engine" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "How it works", href: "/#how" },
        { label: "Categories", href: "/#categories" },
        { label: "Trust & safety", href: "/#trust" },
      ],
    },
  ];

  return (
    <footer className="mt-24 border-t border-white/10 bg-ink-950/60 pb-20 sm:pb-10">
      <div className="frame grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[0.8125rem] leading-relaxed muted">
            A needs-first reverse marketplace. Buyers post real requirements,
            providers bid, and the compatibility engine ranks every offer on
            merit — not on ad spend.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="chip text-white/60">
              <span className="size-1.5 rounded-full bg-white/70 animate-pulse-soft" />
              Live demo build
            </span>
            <span className="chip text-white/60">MIT licensed</span>
          </div>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-white/50 uppercase">
              {group.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[0.8125rem] text-white/65 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="frame flex flex-col gap-3 border-t border-white/6 pt-6 text-xs faint sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} XMARKET. Prototype interface.</p>
        <p>
          Compatibility Score = w₁ · Budget + w₂ · Timeline + w₃ · Relevance
        </p>
      </div>
    </footer>
  );
}

export function PageHeader({
  eyebrow,
  title,
  body,
  actions,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.22em] text-white/75 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[1.75rem] font-semibold text-white md:text-[2.25rem] md:leading-[1.12]">
          {title}
        </h1>
        {body && <p className="mt-3 text-[0.9375rem] leading-relaxed muted">{body}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
