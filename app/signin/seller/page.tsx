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
  const [merchantName, setMerchantName] = React.useState("");
  const [shopName, setShopName] = React.useState("");
  const [domain, setDomain] = React.useState<CategoryId | "">("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "seller",
          email,
          password,
          merchantName,
          shopName,
          domain,
        }),
      });
      const json = await response.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Something went wrong.");
      setIssued(json.data.merchantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // The merchant ID is issued by the platform, so it is shown once here and
  // only after the details behind it have been saved.
  if (issued) {
    return (
      <div className="frame py-20 md:py-28">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Your merchant ID
          </h1>
          <p className="mt-3 text-sm leading-relaxed muted">
            This ID is issued by XMarket and cannot be changed. Your performance
            score is recorded against it and is used to rank your offers.
          </p>

          <Card className="mt-8">
            <p className="text-center font-mono text-2xl tracking-widest text-white">
              {issued}
            </p>
          </Card>

          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={() => {
              router.push("/seller");
              router.refresh();
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="frame py-20 md:py-28">
      <div className="mx-auto max-w-md">
        <Link
          href="/signin"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Seller sign in
        </h1>
        <p className="mt-3 text-sm leading-relaxed muted">
          Enter your details and XMarket will issue your merchant ID.
        </p>

        <Card className="mt-8">
          <form onSubmit={submit}>
            <label className="label" htmlFor="seller-merchant">
              Merchant name
            </label>
            <input
              id="seller-merchant"
              required
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="Bitforge Technologies"
              className="field h-11"
            />

            <div className="mt-4">
              <label className="label" htmlFor="seller-shop">
                Shop or service name
              </label>
              <input
                id="seller-shop"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Bitforge Studio"
                className="field h-11"
              />
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="seller-domain">
                Domain you sell in
              </label>
              <select
                id="seller-domain"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value as CategoryId)}
                className="field h-11"
              >
                <option value="">Select a domain</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="seller-email">
                Email
              </label>
              <input
                id="seller-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="field h-11"
              />
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="seller-password">
                Password
              </label>
              <input
                id="seller-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="field h-11"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy} className="mt-6 w-full">
              {busy ? "Please wait…" : "Get my merchant ID"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
