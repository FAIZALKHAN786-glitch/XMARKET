"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BIDS,
  BUYERS,
  ME_BUYER,
  ME_PROVIDER,
  PROVIDERS,
  REQUIREMENTS,
} from "./data";
import { DEFAULT_WEIGHTS } from "./engine";
import type {
  Bid,
  BidStatus,
  Requirement,
  RequirementStatus,
  Role,
  Weights,
} from "./types";

const STORAGE_KEY = "xmarket.state.v1";

interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "success" | "warn";
}

interface Persisted {
  requirements: Requirement[];
  bids: Bid[];
  role: Role;
  weights: Weights;
  saved: string[];
}

interface StoreValue extends Persisted {
  hydrated: boolean;
  meBuyerId: string;
  meProviderId: string;
  buyers: typeof BUYERS;
  providers: typeof PROVIDERS;
  toasts: Toast[];
  setRole: (role: Role) => void;
  addRequirement: (
    input: Omit<Requirement, "id" | "postedAt" | "views" | "status">
  ) => string;
  addBid: (
    input: Omit<Bid, "id" | "createdAt" | "status">
  ) => string;
  setBidStatus: (id: string, status: BidStatus) => void;
  setRequirementStatus: (id: string, status: RequirementStatus) => void;
  setWeights: (weights: Weights) => void;
  toggleSaved: (requirementId: string) => void;
  reset: () => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const seed = (): Persisted => ({
  requirements: REQUIREMENTS,
  bids: BIDS,
  role: "buyer",
  weights: DEFAULT_WEIGHTS,
  saved: ["r_pcba", "r_migration"],
});

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(seed);
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        setState((prev) => ({
          requirements: parsed.requirements?.length
            ? parsed.requirements
            : prev.requirements,
          bids: parsed.bids ?? prev.bids,
          role: parsed.role ?? prev.role,
          weights: parsed.weights ?? prev.weights,
          saved: parsed.saved ?? prev.saved,
        }));
      }
    } catch {
      /* first run or cleared storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked — the app still works in memory */
    }
  }, [state, hydrated]);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { ...toast, id }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((item) => item.id !== id)),
      4200
    );
  }, []);

  const value = useMemo<StoreValue>(() => {
    const patch = (fn: (prev: Persisted) => Persisted) => setState(fn);

    return {
      ...state,
      hydrated,
      meBuyerId: ME_BUYER,
      meProviderId: ME_PROVIDER,
      buyers: BUYERS,
      providers: PROVIDERS,
      toasts,
      pushToast,
      dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),

      setRole: (role) => patch((p) => ({ ...p, role })),

      addRequirement: (input) => {
        const id = uid("r");
        const requirement: Requirement = {
          ...input,
          id,
          postedAt: new Date().toISOString(),
          views: 0,
          status: "open",
        };
        patch((p) => ({ ...p, requirements: [requirement, ...p.requirements] }));
        pushToast({
          title: "Requirement published",
          body: "Providers in this category are being notified now.",
          tone: "success",
        });
        return id;
      },

      addBid: (input) => {
        const id = uid("bid");
        const bid: Bid = {
          ...input,
          id,
          createdAt: new Date().toISOString(),
          status: "pending",
        };
        patch((p) => ({ ...p, bids: [bid, ...p.bids] }));
        pushToast({
          title: "Proposal submitted",
          body: "The buyer has been notified and your score is live.",
          tone: "success",
        });
        return id;
      },

      setBidStatus: (id, status) => {
        patch((p) => ({
          ...p,
          bids: p.bids.map((b) => (b.id === id ? { ...b, status } : b)),
        }));
        const labels: Record<BidStatus, string> = {
          pending: "moved back to review",
          shortlisted: "shortlisted",
          accepted: "accepted — the deal is live",
          rejected: "declined",
        };
        pushToast({
          title: `Proposal ${labels[status]}`,
          tone: status === "accepted" ? "success" : "default",
        });
      },

      setRequirementStatus: (id, status) =>
        patch((p) => ({
          ...p,
          requirements: p.requirements.map((r) =>
            r.id === id ? { ...r, status } : r
          ),
        })),

      setWeights: (weights) => patch((p) => ({ ...p, weights })),

      toggleSaved: (requirementId) =>
        patch((p) => ({
          ...p,
          saved: p.saved.includes(requirementId)
            ? p.saved.filter((x) => x !== requirementId)
            : [...p.saved, requirementId],
        })),

      reset: () => {
        setState(seed());
        pushToast({ title: "Demo data restored" });
      },
    };
  }, [state, hydrated, toasts, pushToast]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Selector helpers — keep pages tidy. */
export function useRequirement(id: string) {
  const { requirements } = useStore();
  return requirements.find((r) => r.id === id);
}

export function useBidsFor(requirementId: string) {
  const { bids } = useStore();
  return bids.filter((b) => b.requirementId === requirementId);
}

export function useProviderFor(providerId: string) {
  const { providers } = useStore();
  return providers.find((p) => p.id === providerId);
}

export function useBuyerFor(buyerId: string) {
  const { buyers } = useStore();
  return buyers.find((b) => b.id === buyerId);
}
