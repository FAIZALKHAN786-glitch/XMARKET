import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { MobileTabBar, SiteFooter, SiteHeader } from "@/components/nav";
import { Toaster } from "@/components/ui/overlay";

export const metadata: Metadata = {
  title: {
    default: "XMARKET — post your need, let providers compete",
    template: "%s · XMARKET",
  },
  description:
    "A needs-first reverse marketplace. Buyers post requirements with a budget and deadline, providers submit tailored offers, and a compatibility engine ranks every bid on budget fit, timeline and relevance.",
  keywords: [
    "reverse marketplace",
    "procurement",
    "RFQ",
    "bidding platform",
    "supplier matching",
  ],
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          No external fonts: the middleware's CSP allows 'self' only, so a
          fonts.googleapis.com link would be blocked on every page (and log
          console errors). The --font-sans stack in globals.css falls back to
          the system fonts, so rendering is identical with no network access.
        */}
      </head>
      <body className="min-h-dvh font-sans">
        <StoreProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-white"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <MobileTabBar />
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
