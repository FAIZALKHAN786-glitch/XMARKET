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
      className="grid shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent text-[var(--color-iris-300)]"
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}
