"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "./session-provider";
import { Button } from "./ui";

export function SiteHeader({ active }: { active?: "home" | "dashboard" | "post" | "browse" | "profile" }) {
  const { account, logout } = useSession();
  const router = useRouter();
  const dashboard = account?.role === "seller" ? "/seller-dashboard" : "/buyer-dashboard";

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href={account ? dashboard : "/"} className="brand" aria-label="X Market home">
          <span className="brand-mark" aria-hidden="true">×</span>
          <span>X Market</span>
        </Link>

        {account && (
          <nav className="header-nav" aria-label="Main navigation">
            <Link href={dashboard} className={active === "dashboard" ? "nav-link active" : "nav-link"}>
              Dashboard
            </Link>
            <Link href="/requirements" className={active === "browse" ? "nav-link active" : "nav-link"}>
              Browse
            </Link>
            {account.role === "buyer" && (
              <Link href="/requirements/post" className={active === "post" ? "nav-link active" : "nav-link"}>
                Post requirement
              </Link>
            )}
            <Link href={`/id/${account.xMarketId}`} className={active === "profile" ? "nav-link active" : "nav-link"}>
              My card
            </Link>
          </nav>
        )}

        <div className="header-actions">
          {account ? (
            <>
              <span className="id-chip num" title="Your XMarket ID">{account.xMarketId}</span>
              <Button
                tone="ghost"
                className="header-logout"
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">
              Sign in <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span className="brand footer-brand"><span className="brand-mark" aria-hidden="true">×</span> X Market</span>
        <span className="footer-note">Buyers post. Providers bid. The best match wins.</span>
        <span className="footer-meta num">XM / 2026</span>
      </div>
    </footer>
  );
}
