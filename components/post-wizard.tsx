"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  Eye,
  Info,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIES, PROVIDERS, REQUIREMENTS } from "@/lib/data";
import { deadlineLabel, usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { CategoryId } from "@/lib/types";
import { CategoryIcon, CategoryMark } from "./icons";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Progress,
} from "./ui/primitives";

const STEPS = [
  { id: 0, label: "The need", hint: "What do you need done?" },
  { id: 1, label: "Specs", hint: "Must-haves and scoring tags" },
  { id: 2, label: "Commercials", hint: "Budget and deadline" },
];

const isoDaysFrom = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function PostWizard() {
  const router = useRouter();
  const { addRequirement, requirements, role } = useStore();

  const [step, setStep] = React.useState(0);
  const [category, setCategory] = React.useState<CategoryId>("manufacturing");
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [location, setLocation] = React.useState("Remote");
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagDraft, setTagDraft] = React.useState("");
  const [mustHaves, setMustHaves] = React.useState<string[]>([]);
  const [mustDraft, setMustDraft] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState(50000);
  const [budgetTarget, setBudgetTarget] = React.useState(40000);
  const [deadline, setDeadline] = React.useState(isoDaysFrom(60));
  const [closesAt, setClosesAt] = React.useState(isoDaysFrom(14));
  const [touched, setTouched] = React.useState(false);

  const suggestedTags = React.useMemo(() => {
    const fromCategory = REQUIREMENTS.filter((r) => r.category === category)
      .flatMap((r) => r.tags)
      .slice(0, 8);
    return Array.from(new Set(fromCategory));
  }, [category]);

  const matchedProviders = PROVIDERS.filter((p) =>
    p.categories.includes(category)
  );
  const panel = CATEGORIES.find((c) => c.id === category)!;

  const errors: string[] = [];
  if (step >= 0 && title.trim().length < 8)
    errors.push("Give your requirement a descriptive title (8+ characters).");
  if (step >= 1 && tags.length < 2)
    errors.push("Add at least two scoring tags so offers can be compared.");
  if (step >= 2) {
    if (budgetTarget > budgetMax)
      errors.push("Target price cannot exceed the budget ceiling.");
    if (new Date(deadline) <= new Date())
      errors.push("The delivery deadline must be in the future.");
    if (new Date(closesAt) >= new Date(deadline))
      errors.push("The bidding window must close before the delivery deadline.");
  }

  const stepValid = (s: number) => {
    if (s === 0) return title.trim().length >= 8 && summary.trim().length > 10;
    if (s === 1) return tags.length >= 2;
    return errors.length === 0;
  };

  const next = () => {
    setTouched(true);
    if (!stepValid(step)) return;
    setTouched(false);
    setStep((s) => Math.min(2, s + 1));
  };

  const publish = () => {
    setTouched(true);
    if (errors.length) return;
    const id = addRequirement({
      title: title.trim(),
      summary: summary.trim(),
      description:
        description.trim() || summary.trim() || "Details to be confirmed.",
      category,
      buyerId: "b_me",
      budgetMax,
      budgetTarget,
      deadline: new Date(deadline).toISOString(),
      closesAt: new Date(closesAt).toISOString(),
      location: location.trim() || "Remote",
      tags,
      mustHaves:
        mustHaves.length > 0
          ? mustHaves
          : ["Details confirmed on award"],
    });
    router.push(`/market/${id}`);
  };

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value || tags.includes(value)) return;
    setTags((prev) => [...prev, value]);
    setTagDraft("");
  };

  return (
    <div className="frame pt-10 pb-16 md:pt-14">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.22em] text-white/75 uppercase">
            {role === "buyer" ? "New requirement" : "Post as buyer"}
          </p>
          <h1 className="text-[1.75rem] font-semibold text-white md:text-[2.25rem] md:leading-[1.12]">
            Describe the need once
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed muted">
            The more precisely you specify must-haves and scoring tags, the
            better the engine can separate a genuinely good offer from a cheap
            one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="muted">
            <Sparkles className="size-3" />
            Free to post
          </Badge>
          <span className="num text-xs faint">
            {requirements.length} live requirements
          </span>
        </div>
      </div>

      {/* stepper */}
      <ol className="mt-7 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => s.id < step && setStep(s.id)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition",
                  active
                    ? "border-white/45/50 bg-white/10"
                    : done
                      ? "border-white/10 bg-white/5 hover:border-white/25"
                      : "border-white/10 bg-white/[0.015] opacity-70"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg text-[0.75rem] font-bold",
                      done
                        ? "bg-white text-black"
                        : active
                          ? "bg-white text-white"
                          : "bg-white/5 text-white/50"
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : s.id + 1}
                  </span>
                  <div>
                    <p
                      className={cn(
                        "text-[0.875rem] font-semibold",
                        active || done ? "text-white" : "text-white/60"
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="text-xs faint">{s.hint}</p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* --------------------------------------------------- form column */}
        <div className="space-y-5">
          {step === 0 && (
            <Card>
              <h2 className="text-[1.0625rem] font-semibold text-white">
                What do you need?
              </h2>

              <div className="mt-5">
                <span className="label">Category</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      aria-pressed={category === c.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                        category === c.id
                          ? "border-white/45/55 bg-white/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25"
                      )}
                    >
                      <CategoryIcon
                        category={c.id}
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          category === c.id
                            ? "text-white/75"
                            : "text-white/45"
                        )}
                      />
                      <span>
                        <span className="block text-[0.8125rem] font-medium text-white">
                          {c.label}
                        </span>
                        <span className="mt-0.5 block text-xs faint">
                          {c.blurb}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <label className="label" htmlFor="req-title">
                  Requirement title
                </label>
                <input
                  id="req-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Precision aluminium housings — 500 unit pilot run"
                  className="field h-11"
                />
              </div>

              <div className="mt-4">
                <label className="label" htmlFor="req-summary">
                  One-line summary
                </label>
                <input
                  id="req-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="The short version a provider sees in the feed"
                  className="field h-11"
                />
              </div>

              <div className="mt-4">
                <label className="label" htmlFor="req-description">
                  Full description
                </label>
                <textarea
                  id="req-description"
                  rows={7}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope, quantities, materials, what happens on award, what you'll supply…"
                  className="field resize-y leading-relaxed"
                />
              </div>

              <div className="mt-4">
                <label className="label" htmlFor="req-location">
                  Location / delivery point
                </label>
                <input
                  id="req-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Austin, TX — or Remote"
                  className="field h-11"
                />
              </div>
            </Card>
          )}

          {step === 1 && (
            <>
              <Card>
                <h2 className="text-[1.0625rem] font-semibold text-white">
                  Scoring tags
                </h2>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed muted">
                  Tags are the vocabulary the engine uses for the relevance
                  factor. Providers tick the ones they satisfy — coverage is
                  worth real points.
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="chip border-white/45/40 bg-white/14 text-white/75"
                    >
                      {tag}
                      <button
                        onClick={() =>
                          setTags((prev) => prev.filter((t) => t !== tag))
                        }
                        aria-label={`Remove ${tag}`}
                        className="ml-0.5 text-white/60 hover:text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && (
                    <span className="text-xs faint">
                      No tags yet — pick suggestions below or type your own.
                    </span>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                    placeholder="Type a tag and press Enter"
                    className="field flex-1"
                    aria-label="Add tag"
                  />
                  <Button variant="secondary" onClick={() => addTag(tagDraft)}>
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>

                <p className="label mt-5">Suggested for {panel.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      disabled={tags.includes(t)}
                      className={cn(
                        "chip transition",
                        tags.includes(t)
                          ? "opacity-40"
                          : "text-white/65 hover:border-white/45/50 hover:text-white"
                      )}
                    >
                      <Plus className="size-3" />
                      {t}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-[1.0625rem] font-semibold text-white">
                  Must-haves
                </h2>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed muted">
                  Hard requirements. Providers see these as a checklist — they
                  rarely affect the score, but they filter out the wrong bids.
                </p>

                <ul className="mt-4 space-y-2">
                  {mustHaves.map((m, i) => (
                    <li
                      key={`${m}-${i}`}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                    >
                      <Target className="size-3.5 shrink-0 text-white/60" />
                      <span className="flex-1 text-[0.8125rem] text-white/85">
                        {m}
                      </span>
                      <button
                        onClick={() =>
                          setMustHaves((prev) => prev.filter((_, xi) => xi !== i))
                        }
                        aria-label={`Remove ${m}`}
                        className="text-white/35 hover:text-white/45"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                  {mustHaves.length === 0 && (
                    <li className="text-xs faint">Nothing added yet.</li>
                  )}
                </ul>

                <div className="mt-4 flex gap-2">
                  <input
                    value={mustDraft}
                    onChange={(e) => setMustDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && mustDraft.trim()) {
                        e.preventDefault();
                        setMustHaves((prev) => [...prev, mustDraft.trim()]);
                        setMustDraft("");
                      }
                    }}
                    placeholder="e.g. ISO 9001 certified facility"
                    className="field flex-1"
                    aria-label="Add must-have"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!mustDraft.trim()) return;
                      setMustHaves((prev) => [...prev, mustDraft.trim()]);
                      setMustDraft("");
                    }}
                  >
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>
              </Card>
            </>
          )}

          {step === 2 && (
            <Card>
              <h2 className="text-[1.0625rem] font-semibold text-white">
                Budget &amp; timing
              </h2>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed muted">
                The target price and the ceiling do different jobs: the target
                anchors budget scoring, the ceiling is a hard limit the engine
                penalises heavily.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="budget-target">
                    Target price (USD)
                  </label>
                  <input
                    id="budget-target"
                    type="number"
                    min={100}
                    step={500}
                    value={budgetTarget}
                    onChange={(e) => setBudgetTarget(Number(e.target.value))}
                    className="field num"
                  />
                  <p className="mt-1.5 text-xs faint">
                    Offers at or under this score best on budget fit.
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="budget-max">
                    Budget ceiling (USD)
                  </label>
                  <input
                    id="budget-max"
                    type="number"
                    min={100}
                    step={500}
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(Number(e.target.value))}
                    className="field num"
                  />
                  <p className="mt-1.5 text-xs faint">
                    Hard limit — bids above this are flagged as risky.
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="deadline">
                    Delivery needed by
                  </label>
                  <input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="field num"
                  />
                  <p className="mt-1.5 text-xs faint">
                    {deadlineLabel(new Date(deadline).toISOString())}
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="closes">
                    Bidding closes
                  </label>
                  <input
                    id="closes"
                    type="date"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    className="field num"
                  />
                  <p className="mt-1.5 text-xs faint">
                    Providers can submit or revise until this date.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between text-[0.8125rem]">
                  <span className="text-white/70">Budget envelope</span>
                  <span className="num font-semibold text-white">
                    {usd(budgetTarget)} – {usd(budgetMax)}
                  </span>
                </div>
                <Progress
                  value={
                    budgetMax > 0
                      ? Math.min(100, (budgetTarget / budgetMax) * 100)
                      : 0
                  }
                  className="mt-3"
                  barClassName="bg-white"
                />
                <p className="mt-2 text-xs faint">
                  You are anchoring scoring at{" "}
                  {budgetMax > 0
                    ? Math.round((budgetTarget / budgetMax) * 100)
                    : 0}
                  % of your ceiling — a{" "}
                  {budgetMax - budgetTarget > 0
                    ? usd(budgetMax - budgetTarget, { compact: true })
                    : "$0"}{" "}
                  negotiation band.
                </p>
              </div>

              <div className="mt-5 flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <Info className="mt-0.5 size-4 shrink-0 text-white/75" />
                <p className="text-xs leading-relaxed muted">
                  Budget ceilings are only shown to matched, verified providers.
                  They are never made public or indexed.
                </p>
              </div>
            </Card>
          )}

          {touched && errors.length > 0 && (
            <ul className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4">
              {errors.map((e) => (
                <li
                  key={e}
                  className="flex gap-2 text-[0.8125rem] text-white/45"
                >
                  <X className="mt-0.5 size-3.5 shrink-0" />
                  {e}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button size="lg" onClick={next}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={publish}>
                <Send className="size-4" />
                Publish requirement
              </Button>
            )}
            <span className="text-xs faint">
              Step {step + 1} of 3 · nothing is published until you hit the
              final button
            </span>
          </div>
        </div>

        {/* -------------------------------------------------- preview col */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
          <Card>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                <Eye className="size-3.5" /> Live preview
              </p>
              <Badge tone="outline">
                {matchedProviders.length} providers matched
              </Badge>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <CategoryMark category={category} size={38} />
              <div className="min-w-0">
                <p className="text-[0.9375rem] leading-snug font-semibold text-white">
                  {title || "Your requirement title appears here"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs muted">
                  {summary || "And a one-line summary providers scan in the feed."}
                </p>
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-[0.8125rem]">
              <PreviewLine
                icon={<Wallet className="size-3.5" />}
                label="Budget"
                value={`${usd(budgetTarget, { compact: true })} – ${usd(
                  budgetMax,
                  { compact: true }
                )}`}
              />
              <PreviewLine
                icon={<CalendarClock className="size-3.5" />}
                label="Needed by"
                value={deadlineLabel(new Date(deadline).toISOString())}
              />
              <PreviewLine
                icon={<Users className="size-3.5" />}
                label="Location"
                value={location || "—"}
              />
              <PreviewLine
                icon={<Target className="size-3.5" />}
                label="Must-haves"
                value={`${mustHaves.length} listed`}
              />
            </dl>

            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-4">
                {tags.map((t) => (
                  <span key={t} className="chip text-white/65">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Who gets notified
            </p>
            <ul className="mt-4 space-y-3">
              {matchedProviders.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/5 text-[0.6875rem] font-semibold text-white/80">
                    {p.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-[0.8125rem] font-medium text-white">
                      {p.name}
                      {p.verified && (
                        <BadgeCheck className="size-3 shrink-0 text-white/60" />
                      )}
                    </p>
                    <p className="truncate text-[0.6875rem] faint">
                      {p.rating.toFixed(1)}★ · {p.onTimeRate}% on time
                    </p>
                  </div>
                </li>
              ))}
              {matchedProviders.length === 0 && (
                <li className="text-xs faint">
                  No verified providers in this category yet.
                </li>
              )}
            </ul>
            <p className="mt-4 text-xs leading-relaxed faint">
              Matched by category, capability tags and capacity. Providers with
              a poor fit for your budget band are excluded automatically.
            </p>
          </Card>

          <Card>
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Writing a better brief
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Name the deliverable, not the activity.",
                "State quantities and units precisely.",
                "Say what you supply (files, materials, site access).",
                "Put the true ceiling — a lowball ceiling attracts no serious bids.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-[0.8125rem] muted">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-white" />
                  {t}
                </li>
              ))}
            </ul>
            <ButtonLink
              href="/market"
              variant="ghost"
              size="sm"
              className="mt-4 -ml-3"
            >
              See how other buyers write briefs
              <ArrowRight className="size-3.5" />
            </ButtonLink>
          </Card>

        </aside>
      </div>
    </div>
  );
}

function PreviewLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-white/55">
        {icon}
        {label}
      </dt>
      <dd className="num truncate font-medium text-white/90">{value}</dd>
    </div>
  );
}
