"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  Box,
  Home,
  Calendar,
  MapPin,
  Search,
  Clock,
  Star,
  BarChart3,
  Settings,
} from "lucide-react";
import AppShell from "../AppShell";
import ProviderSidebar from "./ProviderSidebar";
import OfferModal from "./OfferModal";
import EmptyState from "../EmptyState";
import { SkeletonRequirementRow } from "../Skeleton";
import { fetchRequirements, fetchMyOffers } from "@/lib/api";

const CATEGORY_FILTERS = ["All Categories", "Electronics", "Furniture", "Services"];
const BUDGET_FILTERS = [
  { id: "any", label: "Any Budget" },
  { id: "under100", label: "Under $100" },
  { id: "100to500", label: "$100 – $500" },
  { id: "over500", label: "$500+" },
];

const ICONS = { phone: Smartphone, box: Box, home: Home };

function RequirementCard({ req, onOffer }) {
  const Icon = ICONS[req.icon] || Box;
  return (
    <div className="glass req-card">
      <span className="req-icon">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <div className="req-mid">
        <div className="req-top">
          <span className="req-title">{req.title}</span>
          <span className="cat-pill">{req.category}</span>
        </div>
        <div className="req-meta">
          <span className="req-budget">{req.budget}</span>
          <span className="req-meta-item">
            <Calendar size={13} strokeWidth={1.5} />
            Deadline: {req.deadline}
          </span>
          <span className="req-meta-item">
            <MapPin size={13} strokeWidth={1.5} />
            {req.location}
          </span>
        </div>
      </div>
      <div className="req-right">
        <span className="req-time">{req.posted}</span>
        <button type="button" className="req-offer-btn" onClick={() => onOffer(req)}>
          Make Offer
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
  );
}

export default function ProviderView() {
  const [view, setView] = useState("requirements");
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [category, setCategory] = useState("All Categories");
  const [budgetFilter, setBudgetFilter] = useState("any");
  const [search, setSearch] = useState("");
  const [modalReq, setModalReq] = useState(null);

  /* TODO: GET /api/requirements (public feed)
     TODO: GET /api/offers (my offers as provider) */
  useEffect(() => {
    let alive = true;
    Promise.all([fetchRequirements(), fetchMyOffers()]).then(([reqs, offers]) => {
      if (!alive) return;
      setRequirements(reqs);
      setMyOffers(offers);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return requirements.filter((r) => {
      if (category !== "All Categories" && r.category !== category) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (budgetFilter === "under100" && r.budgetMax >= 100) return false;
      if (budgetFilter === "100to500" && (r.budgetMax < 100 || r.budgetMax > 500))
        return false;
      if (budgetFilter === "over500" && r.budgetMax <= 500) return false;
      return true;
    });
  }, [requirements, category, search, budgetFilter]);

  const feed = (
    <section aria-label="Active requirements">
      <div className="feed-header">
        <h1 className="feed-title">Active Requirements</h1>
        <div className="feed-header-right">
          <div className="search-compact">
            <Search size={14} strokeWidth={1.5} />
            <input
              type="search"
              placeholder="Search requirements…"
              aria-label="Search requirements"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="feed-filters">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            type="button"
            className={`sort-pill ${category === c ? "active" : ""}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
        <select
          className="ghost-select"
          aria-label="Filter by budget"
          value={budgetFilter}
          onChange={(e) => setBudgetFilter(e.target.value)}
        >
          {BUDGET_FILTERS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="req-list">
        {loading ? (
          <>
            <SkeletonRequirementRow />
            <SkeletonRequirementRow />
            <SkeletonRequirementRow />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No active requirements"
            sub="New buyer requirements will appear here."
            actionLabel="Refresh"
            onAction={() => window.location.reload()}
          />
        ) : (
          filtered.map((req) => (
            <RequirementCard key={req.id} req={req} onOffer={setModalReq} />
          ))
        )}
      </div>
    </section>
  );

  const offersTable = (
    <section className="offers-section" aria-label="My submitted offers">
      <div className="offers-section-head">
        <h2 className="feed-title">My Submitted Offers</h2>
      </div>
      <div className="glass offers-table-wrap">
        <table className="offers-table">
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Your Price</th>
              <th>Delivery</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {myOffers.map((o) => (
              <tr key={o.id}>
                <td>{o.requirement}</td>
                <td className="mono-cell">${o.price.toFixed(2)}</td>
                <td>{o.delivery}</td>
                <td>{o.submitted}</td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderView = () => {
    switch (view) {
      case "overview":
        return (
          <>
            {feed}
            {offersTable}
          </>
        );
      case "requirements":
        return feed;
      case "offers":
        return offersTable;
      case "reviews":
        return (
          <EmptyState
            icon={Star}
            title="No reviews yet"
            sub="Buyer reviews will appear here after your first completed transaction."
          />
        );
      case "analytics":
        return (
          <EmptyState
            icon={BarChart3}
            title="Analytics coming soon"
            sub="Offer performance, win rates, and revenue trends will land here."
          />
        );
      case "settings":
        return (
          <EmptyState
            icon={Settings}
            title="Settings coming soon"
            sub="Profile, payout, and notification preferences will live here."
          />
        );
      default:
        return feed;
    }
  };

  return (
    <AppShell>
      <div className="prov-layout">
        <ProviderSidebar view={view} setView={setView} />
        <main className="prov-main">
          {renderView()}
        </main>
      </div>

      {/* On "Make Offer" → open Submit Offer Modal */}
      {modalReq && (
        <OfferModal
          requirement={modalReq}
          onClose={() => setModalReq(null)}
          onSubmitted={(offer) => {
            setMyOffers((list) => [
              { id: `m_${Date.now()}`, ...offer },
              ...list,
            ]);
            setModalReq(null);
            // jump the user to their offers so the new row is visible
            setView((v) => (v === "overview" ? v : "offers"));
          }}
        />
      )}
    </AppShell>
  );
}
