"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import AppShell from "../AppShell";
import OfferCard from "./OfferCard";
import ComparePanel from "./ComparePanel";
import EmptyState from "../EmptyState";
import { SkeletonMatchCard } from "../Skeleton";
import { fetchMatches, toggleShortlist, selectOffer } from "@/lib/api";

const SORTS = [
  { id: "all", label: "All" },
  { id: "match", label: "Best Match" },
  { id: "price", label: "Lowest Price" },
  { id: "delivery", label: "Fastest Delivery" },
];

export default function MatchesView() {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [sort, setSort] = useState("all");
  const [shortlist, setShortlist] = useState([]); // ordered offer ids
  const [selectedId, setSelectedId] = useState(null);

  /* TODO: GET /api/matches/{requirementId} */
  useEffect(() => {
    let alive = true;
    fetchMatches().then((data) => {
      if (!alive) return;
      setOffers(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => {
    const list = [...offers];
    if (sort === "match") list.sort((a, b) => b.score - a.score);
    if (sort === "price") list.sort((a, b) => a.price - b.price);
    if (sort === "delivery") list.sort((a, b) => a.deliveryDays - b.deliveryDays);
    return list;
  }, [offers, sort]);

  const onShortlist = (offer) => {
    // TODO: PATCH /api/offers/{id}/shortlist
    toggleShortlist(offer.id, !shortlist.includes(offer.id));
    setShortlist((list) =>
      list.includes(offer.id) ? list.filter((id) => id !== offer.id) : [...list, offer.id]
    );
  };

  const onSelect = async (offer) => {
    // TODO: PATCH /api/offers/{id}/select → begin transaction flow
    await selectOffer(offer.id);
    setSelectedId(offer.id);
  };

  const compared = shortlist
    .map((id) => offers.find((o) => o.id === id))
    .filter(Boolean);

  return (
    <AppShell>
      <main className="match-page">
        {/* HEADER */}
        <div className="match-header">
          <div>
            <h1 className="match-title">Matched Offers</h1>
            <p className="match-sub">for Nokia 3310 under $80 · 3 day delivery</p>
          </div>
          <span className="match-count">
            AI found {offers.length || 12} offers — sorted by match score
          </span>
        </div>

        {/* FILTER / SORT ROW */}
        <div className="match-filters" role="group" aria-label="Sort offers">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sort-pill ${sort === s.id ? "active" : ""}`}
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* MATCH CARDS GRID */}
        {loading ? (
          <div className="match-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonMatchCard key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No offers yet"
            sub="Providers haven't submitted offers yet. Check back soon."
            actionLabel="Notify me when offers arrive"
            onAction={() => {}}
          />
        ) : (
          <div className="match-grid">
            {sorted.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                shortlisted={shortlist.includes(offer.id)}
                selected={selectedId === offer.id}
                onShortlist={onShortlist}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {/* COMPARISON SIDEBAR — ≥ 2 shortlisted */}
        {compared.length >= 2 && (
          <ComparePanel offers={compared} onClear={() => setShortlist([])} />
        )}
      </main>
    </AppShell>
  );
}
