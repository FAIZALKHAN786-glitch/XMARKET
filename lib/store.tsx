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
import { BIDS, BUYERS, ME_BUYER, ME_PROVIDER, PROVIDERS, REQUIREMENTS } from "./data";
import { DEFAULT_WEIGHTS } from "./engine";
import { api, isApiError, type AiStatus, type AuditEvent } from "./api-client";
import type {
  Bid,
  BidStatus,
  Buyer,
  Provider,
  Requirement,
  RequirementStatus,
  Role,
  Weights,
} from "./types";

const PREFS_KEY = "xmarket.prefs.v2";

/* ==========================================================================
   Store
   The server is the source of truth for requirements, offers and providers.
   The client keeps a seeded copy so the first paint (server render and
   hydration) is deterministic and matches exactly, then reconciles with the
   API after mount. UI-only preferences — role, weights, saved ids — stay in
   localStorage because they are not shared state.
   ========================================================================== */

interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "success" | "warn" | "error";
}

interface Prefs {
  role: Role;
  weights: Weights;
  saved: string[];
}

interface StoreValue {
  /* data */
  requirements: Requirement[];
  bids: Bid[];
  providers: Provider[];
  buyers: Buyer[];
  events: AuditEvent[];
  saved: string[];
  role: Role;
  weights: Weights;

  /* meta */
  hydrated: boolean;
  /** True once the API answered; false while running on the seeded fallback. */
  connected: boolean;
  /** Set when the last sync failed, so the UI can say why. */
  syncError: string | null;
  aiStatus: AiStatus | null;
  busy: Record<string, boolean>;
  toasts: Toast[];

  /* identity */
  meBuyerId: string;
  meProviderId: string;

  /* actions */
  refresh: () => Promise<void>;
  setRole: (role: Role) => void;
  setWeights: (weights: Weights) => void;
  toggleSaved: (requirementId: string) => void;
  addRequirement: (
    input: Omit<Requirement, "id" | "postedAt" | "views" | "status">
  ) => Promise<{ id: string }>;
  addBid: (
    input: Omit<Bid, "id" | "createdAt" | "status">
  ) => Promise<{ id: string; score?: number }>;
  setBidStatus: (id: string, status: BidStatus) => Promise<void>;
  setRequirementStatus: (id: string, status: RequirementStatus) => Promise<void>;
  reset: () => Promise<void>;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const seedRequirements = () => REQUIREMENTS;
const seedBids = () => BIDS;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [requirements, setRequirements] = useState<Requirement[]>(seedRequirements);
  const [bids, setBids] = useState<Bid[]>(seedBids);
  const [providers, setProviders] = useState<Provider[]>(PROVIDERS);
  const [buyers, setBuyers] = useState<Buyer[]>(BUYERS);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({
    role: "buyer",
    weights: DEFAULT_WEIGHTS,
    saved: ["r_pcba", "r_migration"],
  });
  const [hydrated, setHydrated] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  /* ------------------------------------------------------------ preferences */

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<Prefs>) }));
    } catch {
      /* first run */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* storage blocked — preferences simply do not persist */
    }
  }, [prefs, hydrated]);

  /* ------------------------------------------------------------ server sync */

  const refresh = useCallback(async () => {
    try {
      const payload = await api.bootstrap();
      setRequirements(payload.requirements);
      setBids(payload.bids);
      if (payload.providers.length) setProviders(payload.providers);
      if (payload.buyers.length) setBuyers(payload.buyers);
      setEvents(payload.events);
      setConnected(true);
      setSyncError(null);
    } catch (error) {
      // The UI keeps working on seeded data, but it must not pretend to be
      // connected: the banner reads from `syncError`.
      setConnected(false);
      setSyncError(
        isApiError(error) ? error.message : "Could not reach the XMARKET API"
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
      try {
        const status = await api.ai.status();
        if (!cancelled) setAiStatus(status);
      } catch {
        /* AI status is informational; ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /* ----------------------------------------------------------------- toasts */

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { ...toast, id }]);
    window.setTimeout(() => setToasts((t) => t.filter((item) => item.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    []
  );

  const withBusy = useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      return await fn();
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[key];
        return next;
      });
    }
  }, []);

  /* ---------------------------------------------------------------- actions */

  const value = useMemo<StoreValue>(() => {
    return {
      requirements,
      bids,
      providers,
      buyers,
      events,
      saved: prefs.saved,
      role: prefs.role,
      weights: prefs.weights,
      hydrated,
      connected,
      syncError,
      aiStatus,
      busy,
      toasts,
      meBuyerId: ME_BUYER,
      meProviderId: ME_PROVIDER,
      pushToast,
      dismissToast,
      refresh,

      setRole: (role) => setPrefs((p) => ({ ...p, role })),
      setWeights: (weights) => setPrefs((p) => ({ ...p, weights })),
      toggleSaved: (requirementId) =>
        setPrefs((p) => ({
          ...p,
          saved: p.saved.includes(requirementId)
            ? p.saved.filter((x) => x !== requirementId)
            : [...p.saved, requirementId],
        })),

      addRequirement: (input) =>
        withBusy("requirement:create", async () => {
          try {
            const { requirement } = await api.createRequirement({
              title: input.title,
              summary: input.summary,
              description: input.description,
              category: input.category,
              budgetMax: input.budgetMax,
              budgetTarget: input.budgetTarget,
              deadline: input.deadline,
              closesAt: input.closesAt,
              location: input.location,
              tags: input.tags,
              mustHaves: input.mustHaves,
              buyerId: input.buyerId,
            });
            setRequirements((prev) => [requirement, ...prev]);
            pushToast({
              title: "Requirement published",
              body: "Matched providers in this category are being notified.",
              tone: "success",
            });
            void refresh();
            return { id: requirement.id };
          } catch (error) {
            const message = isApiError(error) ? error.message : "Could not publish";
            pushToast({ title: "Publish failed", body: message, tone: "error" });
            throw error;
          }
        }),

      addBid: (input) =>
        withBusy("bid:create", async () => {
          // Optimistic insert so the buyer's own view updates immediately; the
          // server's row replaces it once the write is confirmed.
          const optimistic: Bid = {
            ...input,
            id: uid("bid"),
            createdAt: new Date().toISOString(),
            status: "pending",
          };
          setBids((prev) => [optimistic, ...prev]);
          try {
            const { bid } = await api.createBid(input.requirementId, {
              price: input.price,
              deliveryDays: input.deliveryDays,
              pitch: input.pitch,
              coversTags: input.coversTags,
              milestones: input.milestones,
              providerId: input.providerId,
            });
            setBids((prev) => prev.map((b) => (b.id === optimistic.id ? bid : b)));
            pushToast({
              title: "Proposal submitted",
              body: "The buyer has been notified and your compatibility score is live.",
              tone: "success",
            });
            void refresh();
            return { id: bid.id };
          } catch (error) {
            setBids((prev) => prev.filter((b) => b.id !== optimistic.id));
            const message = isApiError(error) ? error.message : "Could not submit the offer";
            pushToast({ title: "Submission rejected", body: message, tone: "error" });
            throw error;
          }
        }),

      setBidStatus: (id, status) =>
        withBusy(`bid:${id}`, async () => {
          const snapshot = bids;
          // Optimistic transition, including the sibling rejections the server
          // performs atomically, so the ledger does not flicker.
          setBids((prev) =>
            prev.map((b) => {
              if (b.id === id) return { ...b, status };
              const sameRequirement =
                b.requirementId === prev.find((x) => x.id === id)?.requirementId;
              if (status === "accepted" && sameRequirement) {
                return { ...b, status: "rejected" as BidStatus };
              }
              return b;
            })
          );
          try {
            const result = await api.updateBidStatus(id, status);
            pushToast({
              title: `Offer ${status}`,
              body: result.message,
              tone: status === "accepted" ? "success" : "default",
            });
            void refresh();
          } catch (error) {
            setBids(snapshot);
            const message = isApiError(error) ? error.message : "Could not update the offer";
            pushToast({ title: "Update rejected", body: message, tone: "error" });
          }
        }),

      setRequirementStatus: (id, status) =>
        withBusy(`requirement:${id}`, async () => {
          const snapshot = requirements;
          setRequirements((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status } : r))
          );
          try {
            await api.updateRequirementStatus(id, status);
          } catch (error) {
            setRequirements(snapshot);
            pushToast({
              title: "Could not update the requirement",
              body: isApiError(error) ? error.message : undefined,
              tone: "error",
            });
          }
        }),

      reset: async () => {
        try {
          await api.resetDemoData();
          await refresh();
          setPrefs((p) => ({ ...p, saved: ["r_pcba", "r_migration"] }));
          pushToast({ title: "Demo data restored" });
        } catch (error) {
          pushToast({
            title: "Reset unavailable",
            body: isApiError(error) ? error.message : undefined,
            tone: "error",
          });
        }
      },
    };
  }, [
    requirements,
    bids,
    providers,
    buyers,
    events,
    prefs,
    hydrated,
    connected,
    syncError,
    aiStatus,
    busy,
    toasts,
    pushToast,
    dismissToast,
    refresh,
    withBusy,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

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
