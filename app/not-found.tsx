import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="frame pt-24 pb-32">
      <div className="mx-auto max-w-xl">
        <p className="text-center text-[0.6875rem] font-bold tracking-[0.22em] text-white/75 uppercase">
          404 — page not found
        </p>
        <h1 className="mt-4 text-center text-[2rem] font-semibold text-white">
          That requirement isn’t here
        </h1>
        <p className="mt-3 text-center text-[0.9375rem] leading-relaxed muted">
          The listing may have been withdrawn, awarded, or the link was
          mistyped. The marketplace is still full of live needs.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/market" size="lg">
            <Compass className="size-4" />
            Browse the marketplace
          </ButtonLink>
          <ButtonLink href="/" size="lg" variant="outline">
            <Home className="size-4" />
            Back home
          </ButtonLink>
        </div>
        <div className="mt-12">
          <EmptyState
            title="Looking for the comparison view?"
            body="Every requirement with offers has a side-by-side workspace at /compare/{id}."
            action={
              <Link
                href="/compare"
                className="text-[0.8125rem] font-medium text-white/75 hover:text-white"
              >
                Open the comparison dashboard →
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
