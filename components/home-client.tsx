"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Client-only redirect used on `/` to send signed-in visitors to their
 * workspace. We do this on the client (not with server `redirect()`) because
 * Next dev behind proxies produces absolute `Location: http://localhost:3000/...`
 * headers that bounce visitors out of the preview.
 */
export function HomeClient({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  React.useEffect(() => {
    router.replace(redirectTo);
  }, [redirectTo, router]);
  return (
    <div className="frame py-20 text-center text-sm text-white/60">
      Loading your workspace…
    </div>
  );
}
