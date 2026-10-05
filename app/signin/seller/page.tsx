"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { CATEGORIES } from "@/lib/data";
import type { CategoryId } from "@/lib/types";

export default function SellerSignInPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"signin" | "create">("signin");
  const [merchantName, setMerchantName] = React.useState("");
  const [shopName, setShopName] = React.useState("");
  const [domain, setDomain] = React.useState<CategoryId | "">("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const registering = mode === "create";
      const response = await fetch(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          registering
            ? { role: "seller", email, password, merchantName, shopName, domain }
            : { role: "seller", email, password }
        ),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Unable to sign in. Please try again.");
      }

      if (registering && json.data?.merchantId) {
        setIssued(json.data.merchantId);
      } else {
        router.replace("/seller");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (issued) {
    return (
      <div className="frame py-20 md:py-28">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Your merchant ID</h1>
          <p className="mt-3 text-sm leading-relaxed muted">
            This ID is issued by XMarket and cannot be changed. Your performance score is recorded against it and is used to rank your offers.
          </p>
          <Card className="mt-8">
            <p className="text-center font-mono text-2xl tracking-widest text-white">{issued}</p>
          </Card>
          <Button size="lg" className="mt-6 w-full" onClick={() => { router.replace("/seller"); router.refresh(); }}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  const registering = mode === "create";
  return (
    <div className="frame py-20 md:py-28">
      <div className="mx-auto max-w-md">
        <Link href="/signin" className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Seller {registering ? "create account" : "sign in"}
        </h1>
        {registering && <p className="mt-3 text-sm leading-relaxed muted">Create your seller account and XMarket will issue your merchant ID.</p>}

        <Card className="mt-8">
          <form onSubmit={submit}>
            {registering && <>
              <label className="label" htmlFor="seller-merchant">Merchant name</label>
              <input id="seller-merchant" required minLength={2} autoComplete="organization" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Bitforge Technologies" className="field h-11" />
              <div className="mt-4">
                <label className="label" htmlFor="seller-shop">Shop or service name</label>
                <input id="seller-shop" required minLength={2} value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Bitforge Studio" className="field h-11" />
              </div>
              <div className="mt-4">
                <label className="label" htmlFor="seller-domain">Domain you sell in</label>
                <select id="seller-domain" required value={domain} onChange={(e) => setDomain(e.target.value as CategoryId | "")} className="field h-11">
                  <option value="">Select a domain</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </>}
            <div className={registering ? "mt-4" : ""}>
              <label className="label" htmlFor="seller-email">Email</label>
              <input id="seller-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="field h-11" />
            </div>
            <div className="mt-4">
              <label className="label" htmlFor="seller-password">Password</label>
              <input id="seller-password" type="password" required minLength={registering ? 8 : undefined} autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={registering ? "At least 8 characters" : "Your password"} className="field h-11" />
            </div>
            {error && <p role="alert" className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85">{error}</p>}
            <Button type="submit" size="lg" disabled={busy} className="mt-6 w-full">
              {busy ? "Please wait…" : registering ? "Create seller account" : "Sign in"}
            </Button>
          </form>
          <button type="button" disabled={busy} onClick={() => { setMode(registering ? "signin" : "create"); setError(null); }} className="mt-4 w-full text-center text-sm text-white/60 transition-colors hover:text-white disabled:opacity-50">
            {registering ? "Already have an account? Sign in" : "New seller? Create an account"}
          </button>
        </Card>
      </div>
    </div>
  );
}
