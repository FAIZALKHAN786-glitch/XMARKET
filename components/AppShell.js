"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, FileText, Target, Store } from "lucide-react";
import LogoMark from "./LogoMark";
import { USER } from "@/lib/mockData";

/* Breadcrumb trails per route — current page is always rightmost. */
const CRUMBS = {
  "/dashboard": "Post Requirement",
  "/matches": "Match Results",
  "/provider": "Provider Hub",
};

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the avatar dropdown on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const crumb = CRUMBS[pathname] || "Post Requirement";

  return (
    <>
      <header className="topnav">
        <div className="topnav-inner">
          <button
            type="button"
            className="topnav-left"
            onClick={() => router.push("/dashboard")}
            aria-label="Xmarket home"
          >
            <LogoMark size={28} />
            <span className="logo-word">Xmarket</span>
          </button>

          <div className="topnav-crumb" aria-label="Breadcrumb">
            <span className="crumb-parent">Dashboard</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{crumb}</span>
          </div>

          <div className="topnav-right">
            <button type="button" className="bell-btn" aria-label="Notifications (1 unread)">
              <BellRing size={18} strokeWidth={1.5} />
              <span className="bell-dot" aria-hidden="true" />
            </button>

            <div className="nav-divider" aria-hidden="true" />

            {/* TODO: My Posts → GET /api/requirements (mine) → posts list view */}
            <button type="button" className="myposts-btn" onClick={() => router.push("/matches")}>
              My Posts
            </button>

            <div className="avatar-wrap" ref={menuRef}>
              {/* TODO: avatar shows Google profile photo when login used OAuth */}
              <button
                type="button"
                className="avatar"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {USER.initials}
              </button>
              {menuOpen && (
                <div className="avatar-menu glass" role="menu">
                  <button type="button" role="menuitem">Profile</button>
                  <button type="button" role="menuitem">Settings</button>
                  <div className="avatar-menu-sep" />
                  <button type="button" role="menuitem" onClick={() => router.push("/")}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="app-body">{children}</div>

      {/* Mobile tab bar — icon-only, 5 tabs */}
      <nav className="bottomnav" aria-label="Primary">
        <button
          type="button"
          className={`bnav-item ${pathname === "/dashboard" ? "active" : ""}`}
          onClick={() => router.push("/dashboard")}
        >
          <FileText size={20} strokeWidth={1.5} />
          <span>Post</span>
        </button>
        <button
          type="button"
          className={`bnav-item ${pathname === "/matches" ? "active" : ""}`}
          onClick={() => router.push("/matches")}
        >
          <Target size={20} strokeWidth={1.5} />
          <span>Matches</span>
        </button>
        <button
          type="button"
          className={`bnav-item ${pathname === "/provider" ? "active" : ""}`}
          onClick={() => router.push("/provider")}
        >
          <Store size={20} strokeWidth={1.5} />
          <span>Sell</span>
        </button>
        <button type="button" className="bnav-item" aria-label="Notifications">
          <BellRing size={20} strokeWidth={1.5} />
          <span className="bnav-dot" aria-hidden="true" />
          <span>Alerts</span>
        </button>
        <button type="button" className="bnav-item" onClick={() => router.push("/")} aria-label="Account">
          <span className="bnav-avatar">{USER.initials}</span>
          <span>Account</span>
        </button>
      </nav>
    </>
  );
}
