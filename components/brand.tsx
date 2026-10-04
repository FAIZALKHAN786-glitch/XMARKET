import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  size = 34,
  withWordmark = true,
  className,
  href = "/",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="XMARKET home"
    >
      <span
        className="relative grid shrink-0 place-items-center rounded-lg bg-white"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.6}
          height={size * 0.6}
          fill="none"
          stroke="#000000"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {/* two arrows reversing — the "reverse market" mark */}
          <path d="M4 8h11l-2.5-2.5" />
          <path d="M20 16H9l2.5 2.5" />
        </svg>
      </span>
      {withWordmark && (
        <span className="text-[0.9375rem] font-semibold tracking-[0.18em] text-white">
          XMARKET
        </span>
      )}
    </Link>
  );
}
