import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SourceRef } from "@/lib/types";

/**
 * Marks a record that came from outside the app and links back to the original
 * notice. Provenance is shown, never assumed: a listing either carries a source
 * or it was written here.
 */
export function SourceBadge({
  source,
  className,
}: {
  source?: SourceRef;
  className?: string;
}) {
  if (!source) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Imported from ${source.name}${source.ref ? ` (${source.ref})` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5",
        "text-[0.625rem] font-medium text-white/60 transition hover:border-white/35 hover:text-white",
        className
      )}
    >
      <ExternalLink className="size-2.5" />
      {source.name}
    </a>
  );
}
