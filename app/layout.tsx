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
  themeColor: "#05060b",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="ambient min-h-dvh font-sans">
        <StoreProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-[var(--color-iris-500)] focus:px-4 focus:py-2 focus:text-sm focus:text-white"
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
