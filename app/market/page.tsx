import { MarketExplorer } from "@/components/market-explorer";

export const metadata = {
  title: "Marketplace",
  description:
    "Browse open buyer requirements across manufacturing, software, logistics, design, construction and electronics.",
};

export default function MarketPage() {
  return <MarketExplorer />;
}
