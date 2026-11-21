"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { CategoryId } from "@/lib/types";

export type Account = {
  id: string;
  role: "buyer" | "seller";
  username?: string;
  xMarketId: string;
  email: string;
  displayName: string;
  shopName?: string;
  shopLocation?: string;
  shopCategory?: CategoryId;
  merchantId?: string;
  performanceScore?: number;
};

export type RegisterInput = {
  role: "buyer" | "seller";
  username: string;
  password: string;
  shopName?: string;
  shopLocation?: string;
  shopCategory?: CategoryId;
};

type SessionCtx = {
  account: Account | null;
  loading: boolean;
  login: (username: string, password: string, role?: "buyer" | "seller") => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api<{ account: Account | null }>("/api/auth/session")
      .then(({ data }) => {
        if (!alive) return;
        setAccount(data?.account ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setAccount(null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = async (username: string, password: string, role?: "buyer" | "seller") => {
    const r = await api<{ account: Account }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, role }),
    });
    if (r.ok && r.data) setAccount(r.data.account);
    else throw new Error(r.error?.message || "Login failed");
  };

  const register = async (input: RegisterInput) => {
    const r = await api<{ account: Account }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (r.ok && r.data) setAccount(r.data.account);
    else throw new Error(r.error?.message || "Registration failed");
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setAccount(null);
  };

  return (
    <SessionContext.Provider value={{ account, loading, login, register, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be inside SessionProvider");
  return ctx;
}
