"use client";

import * as React from "react";
import { AlertTriangle, Check, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { compatibility, daysUntil, scoreToken } from "@/lib/engine";
import { usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Bid, Requirement } from "@/lib/types";
import { Button, Divider, Progress } from "./ui/primitives";
import { ScoreBreakdown, ScoreRing } from "./ui/score";

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

export function BidComposer({
  requirement,
  onDone,
}: {
  requirement: Requirement;
  onDone?: (id: string) => void;
}) {
  const { addBid, meProviderId, providers } = useStore();
  const me = providers.find((p) => p.id === meProviderId);

  const [price, setPrice] = React.useState(
    Math.round(requirement.budgetTarget * 0.96)
  );
  const [deliveryDays, setDeliveryDays] = React.useState(
    Math.max(7, Math.round(daysUntil(requirement.deadline) * 0.8))
  );
  const [pitch, setPitch] = React.useState(
    `We can deliver this within your window. Here is how we would sequence it, what we need from you on award, and where the risk sits.`
  );
  const [coversTags, setCoversTags] = React.useState<string[]>(
    me ? requirement.tags.filter((t) => me.skills.length > 0).slice(0, 3) : []
  );
  const [milestones, setMilestones] = React.useState([
    { label: "Discovery & plan sign-off", days: 5 },
    { label: "Build / production phase", days: 0 },
    { label: "Delivery & acceptance", days: 0 },
  ]);
  const [touched, setTouched] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const available = daysUntil(requirement.deadline);

  const draft: Bid = {
    id: "draft",
    requirementId: requirement.id,
    providerId: meProviderId,
    price,
    deliveryDays,
    pitch,
    coversTags,
    milestones: milestones
      .map((m, i, arr) => ({
        ...m,
        days:
          m.days ||
          Math.max(
            1,
            Math.round((deliveryDays * (i + 1)) / Math.max(1, arr.length))
          ),
      }))
      .sort((a, b) => a.days - b.days),
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  const score = compatibility(draft, requirement, me);
  const token = scoreToken(score.total);

  const errors: string[] = [];
  if (price <= 0) errors.push("Enter an offer price.");
  if (price > requirement.budgetMax)
    errors.push(
      `Your price is ${usd(price - requirement.budgetMax)} above the buyer's hard ceiling.`
    );
  if (deliveryDays > available)
    errors.push(
      `Delivery runs ${Math.round(deliveryDays - available)} days past the buyer's deadline.`
    );
  if (pitch.trim().length < 40)
    errors.push("Write at least a couple of sentences explaining your approach.");
  if (coversTags.length === 0)
    errors.push("Select at least one requirement tag you can satisfy.");

  const submit = () => {
    setTouched(true);
    if (errors.length) return;
    const id = addBid({
      requirementId: requirement.id,
      providerId: meProviderId,
      price,
      deliveryDays,
      pitch: pitch.trim(),
      coversTags,
      milestones: draft.milestones,
    });
    setSubmitted(true);
    onDone?.(id);
  };

  if (submitted) {
    return (
      <div className="surface p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--color-score-high)_16%,transparent)] text-[var(--color-score-high)]">
          <Check className="size-6" />
        </span>
        <h3 className="mt-4 font-semibold text-white">
          Proposal submitted at {score.total} compatibility
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-[0.8125rem] leading-relaxed muted">
          The buyer has been notified. You&rsquo;ll see status changes on your
          bids page — and you can revise the offer until the bidding window
          closes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* live score preview */}
      <div className="surface overflow-hidden">
        <div className="flex items-center gap-5 border-b border-white/8 bg-white/[0.02] p-5">
          <ScoreRing score={score.total} size={78} stroke={7} />
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Live compatibility preview
            </p>
            <p className={cn("mt-1 text-lg font-semibold", token.text)}>
              {score.grade} fit
            </p>
            <p className="mt-1 text-[0.8125rem] muted">
              Recalculates as you edit price, schedule and tag coverage.
            </p>
          </div>
        </div>
        <div className="p-5">
          <ScoreBreakdown score={score} compact />
        </div>
      </div>

      {/* form */}
      <div className="surface p-5">
        <h3 className="text-[0.9375rem] font-semibold text-white">
          Your offer
        </h3>
        <p className="mt-1 text-[0.8125rem] muted">
          Quotes are compared on normalised price and promised delivery, so be
          specific rather than optimistic.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bid-price">
              Offer price (USD)
            </label>
            <input
              id="bid-price"
              type="number"
              min={1}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="field num"
            />
            <p className="num mt-1.5 text-xs faint">
              Buyer ceiling {usd(requirement.budgetMax)} · target{" "}
              {usd(requirement.budgetTarget)}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="bid-days">
              Delivery (calendar days)
            </label>
            <input
              id="bid-days"
              type="number"
              min={1}
              max={365}
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(Number(e.target.value))}
              className="field num"
            />
            <p className="num mt-1.5 text-xs faint">
              Promised completion{" "}
              {toDateInput(
                new Date(Date.now() + deliveryDays * 86_400_000)
              )}{" "}
              · {Math.round(available)} days available
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Budget position</label>
          <Progress
            value={Math.min(140, (price / requirement.budgetMax) * 100)}
            barClassName={cn(
              price <= requirement.budgetTarget
                ? "bg-[var(--color-score-high)]"
                : price <= requirement.budgetMax
                  ? "bg-[var(--color-score-mid)]"
                  : "bg-[var(--color-score-low)]"
            )}
          />
          <div className="mt-1.5 flex justify-between text-[0.6875rem] faint">
            <span>$0</span>
            <span className="num">
              target {usd(requirement.budgetTarget, { compact: true })}
            </span>
            <span className="num">
              ceiling {usd(requirement.budgetMax, { compact: true })}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <label className="label">
            Requirement tags you cover ({coversTags.length}/
            {requirement.tags.length})
          </label>
          <div className="flex flex-wrap gap-1.5">
            {requirement.tags.map((tag) => {
              const on = coversTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setCoversTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag]
                    )
                  }
                  aria-pressed={on}
                  className={cn(
                    "chip transition",
                    on
                      ? "border-[var(--color-score-high)]/40 bg-[color-mix(in_oklab,var(--color-score-high)_12%,transparent)] text-[var(--color-score-high)]"
                      : "text-white/55 hover:border-white/25 hover:text-white"
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="bid-pitch">
            Approach & pitch
          </label>
          <textarea
            id="bid-pitch"
            rows={6}
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="What will you do, in what order, and what do you need from the buyer on award?"
            className="field resize-y leading-relaxed"
          />
          <p className="num mt-1.5 text-xs faint">
            {pitch.trim().length} characters
          </p>
        </div>

        <Divider />

        <label className="label">Milestone plan (days from award)</label>
        <div className="space-y-2">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="num grid size-6 shrink-0 place-items-center rounded-md bg-white/6 text-[0.6875rem] text-white/60">
                {i + 1}
              </span>
              <input
                value={m.label}
                onChange={(e) =>
                  setMilestones((prev) =>
                    prev.map((x, xi) =>
                      xi === i ? { ...x, label: e.target.value } : x
                    )
                  )
                }
                className="field flex-1"
                placeholder="Milestone description"
              />
              <input
                type="number"
                min={1}
                value={m.days || ""}
                onChange={(e) =>
                  setMilestones((prev) =>
                    prev.map((x, xi) =>
                      xi === i ? { ...x, days: Number(e.target.value) } : x
                    )
                  )
                }
                className="field num w-20"
                placeholder="day"
                aria-label="Day"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-white/80">
            <Info className="size-3.5 text-[var(--color-iris-300)]" />
            Milestones auto-fill evenly if left blank
          </p>
          <p className="mt-1 text-xs muted">
            Buyers shortlist on the plan, not just the price.
          </p>
        </div>

        {touched && errors.length > 0 && (
          <ul className="mt-5 space-y-2 rounded-xl border border-[color-mix(in_oklab,var(--color-score-low)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-score-low)_8%,transparent)] p-3.5">
            {errors.map((e) => (
              <li
                key={e}
                className="flex gap-2 text-[0.8125rem] text-[var(--color-score-low)]"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={submit} size="lg">
            <Sparkles className="size-4" />
            Submit proposal
          </Button>
          <p className="text-xs faint">
            Free to bid · You keep {100}% of the awarded value (demo)
          </p>
        </div>
      </div>
    </div>
  );
}
