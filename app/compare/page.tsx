import Link from "next/link";
import { ArrowRight, Gauge, Sparkles } from "lucide-react";
import { CompareIndex } from "@/components/compare-index";

export const metadata = {
  title: "Comparison",
  description:
    "Side-by-side evaluation of every offer received, scored on budget fit, timeline match and requirement relevance.",
};

export default function ComparePage() {
  return <CompareIndex />;
}

void Link;
void Gauge;
void Sparkles;
void ArrowRight;
