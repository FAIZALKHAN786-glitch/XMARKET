import {
  ArrowRight,
  BarChart3,
  BellRing,
  Compass,
  Eye,
  FileSearch,
  Filter,
  Gauge,
  Handshake,
  Layers,
  Lock,
  MessagesSquare,
  Rocket,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { HeroDemo } from "@/components/landing/hero-demo";
import { CategoryIcon } from "@/components/icons";
import {
  Badge,
  ButtonLink,
  Card,
  SectionHeading,
} from "@/components/ui/primitives";
import { CATEGORIES, PROVIDERS, REQUIREMENTS } from "@/lib/data";
import { usd } from "@/lib/format";

export default function HomePage() {
  const stats = [
    { label: "Open requirements", value: REQUIREMENTS.length * 47 + 12, suffix: "" },
    { label: "Verified providers", value: 3184, suffix: "" },
    { label: "Median time to first offer", value: 42, suffix: " min" },
    { label: "Avg. saving vs. list price", value: 23, suffix: "%" },
  ];

  return (
    <div className="pb-8">
      {/* ============================================================ HERO */}
      <section className="relative overflow-hidden pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="frame">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="outline" className="mb-6">
              <Sparkles className="size-3" />
              Reverse marketplace · needs-first procurement
            </Badge>
            <h1 className="text-[2.5rem] leading-[1.06] font-bold tracking-[-0.03em] text-white sm:text-[3.25rem] lg:text-[4rem]">
              Stop browsing listings.
              <br />
              <span className="text-white">Post what you need.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[1.0625rem] leading-relaxed muted">
              Describe the job once — specifications, budget ceiling, deadline.
              Qualified providers come to you with tailored offers, and the
              compatibility engine ranks every one on budget fit, timeline and
              relevance. No more guessing which quote is actually best.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/post" size="lg">
                Post a requirement
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/market" size="lg" variant="outline">
                <Compass className="size-4" />
                Browse live needs
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs faint">
              Free to post · Offers arrive in minutes · You choose the winner
            </p>
          </div>

          <div className="mt-14">
            <HeroDemo />
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-ink-900 px-5 py-6 text-center">
                <dd className="num text-2xl font-semibold text-white md:text-3xl">
                  {stat.value.toLocaleString()}
                  {stat.suffix}
                </dd>
                <dt className="mt-1.5 text-[0.75rem] muted">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ==================================================== CATEGORY RAIL */}
      <section
        aria-label="Categories in demand"
        className="border-y border-white/10 py-5"
      >
        <div className="frame flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">In demand</span>
          {CATEGORIES.map((c) => (
            <span key={c.id} className="chip text-white/60">
              <CategoryIcon category={c.id} className="size-3.5" />
              {c.label}
            </span>
          ))}
        </div>
      </section>

      {/* ========================================================= HOW */}
      <section id="how" className="frame scroll-mt-24 pt-20 md:pt-28">
        <SectionHeading
          eyebrow="How it works"
          title="The marketplace runs in reverse — and that changes everything"
          body="Traditional marketplaces make you hunt. XMARKET makes the suppliers do the work, then does the analysis for you."
        />

        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: FileSearch,
              step: "01",
              title: "Post the requirement",
              body: "One structured form: category, specs, must-haves, budget ceiling, delivery deadline. Takes about three minutes.",
            },
            {
              icon: BellRing,
              step: "02",
              title: "Providers are matched",
              body: "Verified suppliers whose categories and capabilities overlap your need are notified. No cold outreach, no spam lists.",
            },
            {
              icon: Send,
              step: "03",
              title: "Offers land with a score",
              body: "Each proposal arrives priced, scheduled with milestones, and pre-scored on the three compatibility factors.",
            },
            {
              icon: Trophy,
              step: "04",
              title: "Compare and award",
              body: "Side-by-side dashboard, priority sliders, shortlisting. Accept the winning offer and work begins.",
            },
          ].map((item, i) => (
            <li key={item.step} className="relative">
              <Card hover className="h-full">
                <span className="inline-grid size-10 place-items-center rounded-xl border border-white/45/30 bg-white/10 text-white/75">
                  <item.icon className="size-5" />
                </span>
                <p className="num mt-4 text-[0.6875rem] font-bold tracking-[0.2em] faint">
                  {item.step}
                </p>
                <h3 className="mt-1.5 font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-[0.8125rem] leading-relaxed muted">
                  {item.body}
                </p>
              </Card>
              {i < 3 && (
                <ArrowRight className="absolute top-1/2 -right-4 hidden size-4 -translate-y-1/2 text-white/15 lg:block" />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ====================================================== ENGINE */}
      <section id="engine" className="frame scroll-mt-24 pt-20 md:pt-28">
        <div className="surface overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="border-b border-white/10 p-7 lg:border-r lg:border-b-0 lg:p-10">
              <SectionHeading
                eyebrow="Compatibility engine"
                title="Every offer scored on the things that actually decide a deal"
                body="Not a popularity contest. The engine decomposes each proposal into weighted factors, then explains itself in plain language so you can defend the decision to your team."
              />

              <div className="mt-8 space-y-5">
                {[
                  {
                    icon: Target,
                    label: "Budget fit",
                    body: "Distance from your target price, plus a credibility check on suspiciously cheap bids.",
                    tone: "text-white",
                  },
                  {
                    icon: Timer,
                    label: "Timeline match",
                    body: "Promised delivery measured against your deadline, rewarding realistic buffers.",
                    tone: "text-white/60",
                  },
                  {
                    icon: Layers,
                    label: "Requirement relevance",
                    body: "Tag coverage, category fit, verified credentials and on-time history.",
                    tone: "text-white/75",
                  },
                ].map((f) => (
                  <div key={f.label} className="flex gap-4">
                    <span
                      className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 ${f.tone}`}
                    >
                      <f.icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-[0.9375rem] font-medium text-white">
                        {f.label}
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed muted">
                        {f.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-ink-950/60 p-4">
                <p className="text-[0.6875rem] font-bold tracking-[0.16em] faint uppercase">
                  The formula
                </p>
                <p className="num mt-2 font-mono text-[0.8125rem] text-white/85">
                  score = w₁·budget + w₂·timeline + w₃·relevance
                </p>
                <p className="mt-2 text-xs leading-relaxed muted">
                  Weights default to 0.35 / 0.30 / 0.35 and are fully tunable per
                  requirement — the ranking re-sorts instantly.
                </p>
              </div>
            </div>

            <div className="bg-ink-950/40 p-7 lg:p-10">
              <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-white/40 uppercase">
                Score explainability
              </p>
              <h3 className="mt-3 text-xl font-semibold text-white">
                “Why did this bid win?” — answered on every card
              </h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed muted">
                Here’s what the engine says about a real proposal from the demo
                dataset.
              </p>

              <div className="mt-6 space-y-4">
                <ScoreSample
                  label="Budget fit"
                  score={94}
                  weight="0.35"
                  detail="Comes in under the $78,000 target price."
                  color="#ffffff"
                />
                <ScoreSample
                  label="Timeline match"
                  score={100}
                  weight="0.30"
                  detail="34 days promised against a 46-day window — 12 days of buffer."
                  color="#a6a6a6"
                />
                <ScoreSample
                  label="Requirement relevance"
                  score={96}
                  weight="0.35"
                  detail="5/5 spec tags covered · 4.7★ over 118 reviews, ISO 9001 verified."
                  color="#6b6b6b"
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/40 bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[0.8125rem] font-semibold text-white">
                    Total compatibility
                  </span>
                  <span className="num text-2xl font-bold text-white">
                    96
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-white/70">
                  Excellent fit — recommended for award.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================== CATEGORIES */}
      <section id="categories" className="frame scroll-mt-24 pt-20 md:pt-28">
        <SectionHeading
          align="center"
          eyebrow="Coverage"
          title="Six verticals, one procurement workflow"
          body="Each category carries its own spec vocabulary, so requirements stay precise and offers stay comparable."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const open = REQUIREMENTS.filter((r) => r.category === c.id).length;
            return (
              <Card key={c.id} hover className="group">
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-lg border border-white/12 text-white/70">
                    <CategoryIcon category={c.id} className="size-5" />
                  </span>
                  <span className="num text-[0.6875rem] faint">
                    {open} live
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-white">{c.label}</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed muted">
                  {c.blurb}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ================================================ TWO SIDED VALUE */}
      <section className="frame pt-20 md:pt-28">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-7 lg:p-8">
            <Badge tone="outline">For buyers</Badge>
            <h3 className="mt-4 text-xl font-semibold text-white">
              Run a real procurement process without the spreadsheet
            </h3>
            <ul className="mt-6 space-y-4">
              {[
                {
                  icon: Scale,
                  title: "Comparison dashboard",
                  body: "Normalised price, delivery and score columns across every offer.",
                },
                {
                  icon: Filter,
                  title: "Sort by what matters",
                  body: "Cheapest, fastest, or highest compatibility — switch instantly.",
                },
                {
                  icon: MessagesSquare,
                  title: "Shortlist and negotiate",
                  body: "Shortlist strong bids, decline outliers, accept the winner.",
                },
                {
                  icon: BarChart3,
                  title: "Spend visibility",
                  body: "Track open requirements, offers received, and award value.",
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-3.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/75">
                    <f.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-[0.875rem] font-medium text-white">
                      {f.title}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] muted">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ButtonLink href="/dashboard" variant="outline" className="mt-7">
              Open buyer dashboard
              <ArrowRight className="size-4" />
            </ButtonLink>
          </Card>

          <Card className="p-7 lg:p-8">
            <Badge tone="muted">For providers</Badge>
            <h3 className="mt-4 text-xl font-semibold text-white">
              Stop paying for leads. Bid where you actually fit.
            </h3>
            <ul className="mt-6 space-y-4">
              {[
                {
                  icon: Compass,
                  title: "Opportunity feed",
                  body: "Filter open needs by category, budget band and deadline — only see work you can win.",
                },
                {
                  icon: Gauge,
                  title: "Instant self-score",
                  body: "Before you submit, see how your draft offer will score so you can sharpen the price or schedule.",
                },
                {
                  icon: Users,
                  title: "Transparent status",
                  body: "Pending, shortlisted, accepted — know where you stand instead of chasing buyers.",
                },
                {
                  icon: TrendingUp,
                  title: "Win-rate insight",
                  body: "Learn which factors cost you awards and adjust your bidding.",
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-3.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/75">
                    <f.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-[0.875rem] font-medium text-white">
                      {f.title}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] muted">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ButtonLink href="/market" variant="outline" className="mt-7">
              See open opportunities
              <ArrowRight className="size-4" />
            </ButtonLink>
          </Card>
        </div>
      </section>

      {/* ====================================================== PROVIDERS */}
      <section className="frame pt-20 md:pt-28">
        <SectionHeading
          align="center"
          eyebrow="The supply side"
          title="Verified providers, ranked on evidence"
          body="Credentials, on-time rates and review history feed directly into relevance scoring — so a great track record is worth real points."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROVIDERS.slice(1, 5).map((p) => (
            <Card key={p.id} hover>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-white/12 bg-white/5 text-[0.8125rem] font-semibold text-white/85">
                  {p.initials}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-[0.875rem] font-semibold text-white">
                    {p.name}
                    <ShieldCheck className="size-3.5 shrink-0 text-white/60" />
                  </p>
                  <p className="truncate text-xs faint">{p.location}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-[0.8125rem] leading-relaxed muted">
                {p.tagline}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <span className="inline-flex items-center gap-1 text-white/80">
                  <Star className="size-3 fill-white/70 text-white/70" />
                  <span className="num font-semibold">
                    {p.rating.toFixed(1)}
                  </span>
                  <span className="faint">({p.reviews})</span>
                </span>
                <span className="num faint">{p.onTimeRate}% on time</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ======================================================== TRUST */}
      <section id="trust" className="frame scroll-mt-24 pt-20 md:pt-28">
        <div className="surface grid gap-px overflow-hidden bg-white/5 lg:grid-cols-3">
          {[
            {
              icon: Lock,
              title: "Your specs stay yours",
              body: "Budget ceilings and must-haves are only visible to matched, verified providers — never public.",
            },
            {
              icon: Eye,
              title: "Every score is auditable",
              body: "Factor-level breakdowns with plain-language reasoning, exportable for sign-off.",
            },
            {
              icon: Handshake,
              title: "No paid placement",
              body: "Ranking is purely mathematical. Providers cannot buy a higher position.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-ink-900 p-7">
              <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/75">
                <item.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================= CTA */}
      <section className="frame pt-20 md:pt-28">
        <div className="relative overflow-hidden rounded-2xl border border-white/12 p-8 text-center md:p-14">
          <div className="relative">
            <Badge tone="muted" className="mb-5">
              <Rocket className="size-3" />
              Live demo dataset loaded
            </Badge>
            <h2 className="mx-auto max-w-2xl text-[1.75rem] leading-tight font-bold text-white md:text-[2.5rem]">
              Your next supplier is already looking for work like yours
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-white/70">
              Post a requirement, watch offers arrive pre-scored, and award with
              evidence. Average buyer saves{" "}
              <span className="font-semibold text-white">{usd(18400, { compact: true })}</span>{" "}
              against their budget ceiling.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/post" size="lg">
                Post a requirement
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/compare/r_mech" size="lg" variant="outline">
                <Gauge className="size-4" />
                Try the comparison view
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ScoreSample({
  label,
  score,
  weight,
  detail,
  color,
}: {
  label: string;
  score: number;
  weight: string;
  detail: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[0.8125rem] font-medium text-white/85">
          {label}
          <span className="faint ml-1.5 text-[0.6875rem]">×{weight}</span>
        </span>
        <span className="num text-[0.8125rem] font-semibold" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed faint">{detail}</p>
    </div>
  );
}
