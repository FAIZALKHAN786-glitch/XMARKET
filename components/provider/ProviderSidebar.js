"use client";

import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  SendHorizonal,
  Star,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { PROVIDER_PROFILE } from "@/lib/mockData";

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "requirements", label: "Requirements", icon: FileText },
  { id: "offers", label: "My Offers", icon: SendHorizonal },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function ProviderSidebar({ view, setView }) {
  const router = useRouter();
  const p = PROVIDER_PROFILE;
  const stars = [1, 2, 3, 4, 5];

  return (
    <aside className="prov-sidebar" aria-label="Provider navigation">
      {/* Provider profile card */}
      <div className="glass prov-profile">
        <div className="prov-profile-top">
          <span className="prov-avatar">{p.initials}</span>
          <div className="prov-profile-body">
            <div className="prov-name">{p.name}</div>
            <span className="role-badge">Provider</span>
          </div>
        </div>
        <div className="prov-rating">
          <span className="prov-stars" aria-hidden="true">
            {stars.map((i) => (
              <Star
                key={i}
                size={14}
                strokeWidth={1.5}
                fill={p.rating >= i ? "currentColor" : "none"}
                className={p.rating >= i ? "star-fill" : "star-empty"}
              />
            ))}
          </span>
          <span className="prov-rating-num">{p.rating}</span>
        </div>
      </div>

      <span className="pnav-label">Workspace</span>

      <nav>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`pnav-item ${view === id ? "active" : ""}`}
            aria-current={view === id ? "page" : undefined}
            title={label}
            onClick={() => setView(id)}
          >
            <Icon size={16} strokeWidth={1.5} />
            <span className="pnav-text">{label}</span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="pnav-item pnav-signout"
        onClick={() => router.push("/")}
      >
        <LogOut size={16} strokeWidth={1.5} />
        <span className="pnav-text">Sign Out</span>
      </button>
    </aside>
  );
}
