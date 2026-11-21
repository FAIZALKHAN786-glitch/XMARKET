"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";

export default function DashboardRedirect() {
  const { account, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(!account ? "/login" : account.role === "seller" ? "/seller-dashboard" : "/buyer-dashboard");
  }, [account, loading, router]);

  return <div className="loading">Taking you to your dashboard…</div>;
}
