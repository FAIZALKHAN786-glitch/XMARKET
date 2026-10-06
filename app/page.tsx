import Link from "next/link";
import { Briefcase, Store } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { currentAccount } from "@/lib/server/session";
import { HomeClient } from "@/components/home-client";

// Reads the store, so it cannot be statically rendered at build time.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "XMARKET — post your need, let providers compete",
  description:
    "Choose whether you are buying or selling to continue to XMARKET.",
};

/**
 * Entry point. Renders the buyer/seller role picker directly for anonymous
 * visitors instead of issuing a server `redirect()`.
 *
 * Why: in dev behind a proxy (the Arena preview / any tunnel), Next's
 * `redirect()` produces `Location: http://localhost:3000/...` which bounces
 * the browser off the proxy to a dead localhost URL. Rendering the role
 * picker inline avoids any server redirect entirely. Signed-in visitors are
 * sent to their workspace via a small client-side redirect that uses a
 * relative URL.
 */
export default async function HomePage() {
  const account = await currentAccount();
  if (account) {
    return <HomeClient redirectTo={account.role === "buyer" ? "/buyer" : "/seller"} />;
  }
  return <RolePicker />;
}

function RolePicker() {
  return (
    <div className="frame py-20 md:py-28">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Are you a buyer or a seller?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          You can change from buyer to seller or vice versa.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            {
              href: "/signin/buyer",
              icon: Briefcase,
              title: "I am a buyer",
              body: "Post what you need and let providers come to you.",
            },
            {
              href: "/signin/seller",
              icon: Store,
              title: "I am a seller",
              body: "Receive a merchant ID and bid on requirements in your domain.",
            },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="block">
              <Card hover className="h-full">
                <span className="grid size-10 place-items-center rounded-lg border border-white/12 bg-white/5 text-white/80">
                  <c.icon className="size-5" />
                </span>
                <p className="mt-4 text-[0.9375rem] font-semibold text-white">{c.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60">{c.body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
