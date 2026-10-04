import {
  Boxes,
  CircuitBoard,
  Code2,
  Factory,
  HardHat,
  Palette,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { CategoryId } from "@/lib/types";
import { round } from "@/lib/format";

const MAP: Record<CategoryId, LucideIcon> = {
  manufacturing: Factory,
  software: Code2,
  logistics: Truck,
  design: Palette,
  construction: HardHat,
  electronics: CircuitBoard,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: CategoryId;
  className?: string;
}) {
  const Icon = MAP[category] ?? Boxes;
  return <Icon className={className} />;
}

export function CategoryMark({
  category,
  size = 40,
}: {
  category: CategoryId;
  size?: number;
}) {
  const Icon = MAP[category] ?? Boxes;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg border border-white/12 text-white/70"
      style={{ width: size, height: size }}
    >
      <Icon
        style={{ width: round(size * 0.45), height: round(size * 0.45) }}
      />
    </span>
  );
}
