"use client";

import { Badge, Button, ScoreBar } from "./ui";
import { gradeFor, money, providerXMarketId } from "@/lib/xmarket";

type Factor = { key: string; label: string; score: number; detail?: string };

export function BidCard({
  bid,
  provider,
  score,
  onAccept,
  onDecline,
  isBuyer,
  xMarketId,
}: {
  bid: any;
  provider: any;
  score?: { total: number; grade?: string; factors?: Factor[] } | null;
  onAccept: () => void;
  onDecline: () => void;
  isBuyer: boolean;
  xMarketId?: string;
}) {
  const total = score?.total ?? 0;
  const grade = gradeFor(total);
  const pid = providerXMarketId(bid.providerId, provider?.categories?.[0]);
  const accepted = bid.status === "accepted";

  return (
    <div className={`surface ${accepted ? "border-[#cfe6d6]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={grade === "A" ? "good" : grade === "B" ? "neutral" : "warn"}>
              {grade} · {grade === "A" ? "Top recommended" : grade === "B" ? "Strong match" : grade === "C" ? "Worth a look" : "Lower fit"}
            </Badge>
            <Badge className="num">{pid}</Badge>
          </div>
          <p className="card-title mt-3 mb-1">{provider?.name ?? bid.providerId}</p>
          <p className="text-[12px] text-[#8a8a82] m-0">
            {provider?.rating?.toFixed(1) ?? "—"}★ · {provider?.completedJobs ?? 0} jobs · {provider?.onTimeRate ?? 0}% on time
          </p>
          <p className="text-[13px] text-[#55554f] leading-relaxed mt-3 mb-0">{bid.pitch}</p>
        </div>
        <div className="text-right flex-none">
          <p className="num font-semibold text-xl m-0">{money(bid.price)}</p>
          <p className="card-meta justify-end"><span>{bid.deliveryDays} days</span></p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#e3e3dc]">
        <ScoreBar score={total} label="Compatibility score" />
        <div className="grid grid-cols-3 gap-3 mt-3">
          {(score?.factors ?? []).map((f) => (
            <div key={f.key}>
              <p className="text-[11px] text-[#8a8a82] m-0">{f.label}</p>
              <p className="num text-sm font-semibold m-0">{f.score}/100</p>
              {f.detail && <p className="text-[10px] text-[#8a8a82] leading-snug mt-1">{f.detail}</p>}
            </div>
          ))}
        </div>
      </div>

      {accepted && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: "#f2f8f3", border: "1px solid #cfe6d6" }}>
          <p className="text-[12px] font-semibold m-0" style={{ color: "#16864b" }}>
            Payment held via {xMarketId ?? "your XMarket ID"} · escrow-lite
          </p>
          <div className="mt-2 space-y-1">
            {(bid.milestones?.length ? bid.milestones : [{ label: "Delivery confirmation", days: bid.deliveryDays }]).map((m: any) => (
              <div key={m.label} className="flex justify-between text-[12px] text-[#55554f]">
                <span>{m.label}</span><span className="num">Day {m.days}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isBuyer && (bid.status === "pending" || bid.status === "shortlisted") && (
        <div className="mt-4 flex gap-2">
          <Button onClick={onAccept} className="flex-1">Accept bid</Button>
          <Button onClick={onDecline} tone="danger" className="flex-1">Decline</Button>
        </div>
      )}
      {!isBuyer && <p className="text-[12px] text-[#8a8a82] mt-4 capitalize">Status: {bid.status}</p>}
    </div>
  );
}
