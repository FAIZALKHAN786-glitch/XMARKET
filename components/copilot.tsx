"use client";

import * as React from "react";
import {
  Bot,
  Check,
  ChevronDown,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Badge, Button, ButtonLink, Card } from "@/components/ui/primitives";
import { api, isApiError, type AiMeta } from "@/lib/api-client";
import { useStore } from "@/lib/store";

type WorkspaceRole = "buyer" | "seller";
type Turn = { id: number; role: "user" | "assistant"; content: string };
type CopilotMeta = AiMeta & {
  requirementsInContext?: number;
  role?: WorkspaceRole;
};

const STARTERS: Record<WorkspaceRole, string[]> = {
  buyer: [
    "Summarize my open requirements and incoming offers.",
    "What should I verify before awarding a contract?",
    "Which offers look tight on budget or delivery time?",
  ],
  seller: [
    "Which open opportunities fit my trade?",
    "How can I strengthen a proposal before I send it?",
    "Give me a checklist for reviewing my submitted bids.",
  ],
};

/** A role-aware, private procurement assistant powered by the configured AI service (Gemini by default). */
export function Copilot({ role: pageRole }: { role: WorkspaceRole }) {
  const { account, accountReady, aiStatus } = useStore();
  const role: WorkspaceRole = account
    ? account.role === "seller"
      ? "seller"
      : "buyer"
    : pageRole;

  const [open, setOpen] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [failedMessage, setFailedMessage] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<CopilotMeta | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const nextTurnId = React.useRef(0);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns, busy, error]);

  React.useEffect(() => {
    if (open && accountReady && account) composerRef.current?.focus();
  }, [open, accountReady, account]);

  const newTurn = (turnRole: Turn["role"], content: string): Turn => ({
    id: ++nextTurnId.current,
    role: turnRole,
    content,
  });

  const sendMessage = async (raw: string, retry = false) => {
    const message = raw.trim();
    if (!message || busy || !account) return;

    const failedTurnPending =
      !retry &&
      Boolean(failedMessage) &&
      turns.at(-1)?.role === "user" &&
      turns.at(-1)?.content === failedMessage;
    const precedingTurns = retry || failedTurnPending ? turns.slice(0, -1) : turns;
    const priorHistory = precedingTurns.slice(-12).map(({ role: turnRole, content }) => ({
      role: turnRole,
      content,
    }));

    if (!retry) {
      setTurns([...precedingTurns, newTurn("user", message)]);
    }
    setDraft("");
    setBusy(true);
    setError(null);
    setFailedMessage(null);

    try {
      const data = await api.ai.copilot(message, priorHistory);
      const answer = newTurn("assistant", data.reply);
      setTurns((previous) => [...previous, answer]);
      setMeta(data.meta);
    } catch (err) {
      setError(
        isApiError(err)
          ? err.code === "unauthorized"
            ? "Your session expired. Sign in again to continue this conversation."
            : err.message
          : err instanceof Error
            ? err.message
            : "The assistant could not answer just now. Please try again."
      );
      setFailedMessage(message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const clearConversation = () => {
    if (busy) return;
    setTurns([]);
    setDraft("");
    setError(null);
    setFailedMessage(null);
    setMeta(null);
  };

  const selectedProvider = meta?.provider ?? aiStatus?.provider;
  const providerLabel = meta
    ? meta.mode === "llm"
      ? `${meta.provider} · ${meta.model} · ${meta.latencyMs}ms`
      : "Offline · no model answered"
    : aiStatus?.live
      ? aiStatus.probe?.ok === false
        ? "Gemini unavailable · test connection"
        : `${aiStatus.provider} ${aiStatus.probe?.ok ? "online" : "configured"}`
      : accountReady
        ? "Gemini not connected"
        : "Checking model";
  const providerTone = meta
    ? meta.mode === "llm"
      ? "outline"
      : "warn"
    : aiStatus?.live
      ? "outline"
      : "muted";
  const signInHref = role === "seller" ? "/signin/seller" : "/signin/buyer";

  return (
    <div className="w-full">
      {!open ? (
        <Button
          variant="secondary"
          size="lg"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <Sparkles className="size-4" />
          Ask the assistant
          {aiStatus?.live && selectedProvider === "gemini" && (
            <Badge tone="muted" className="ml-1">Gemini</Badge>
          )}
        </Button>
      ) : (
        <Card className="overflow-hidden p-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/80">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white">XMARKET assistant</h2>
                <p className="mt-0.5 truncate text-xs muted">
                  {role === "buyer" ? "Buyer workspace" : "Provider workspace"} · private, account-scoped context
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                tone={providerTone}
                className="max-w-[13rem] truncate"
                title={aiStatus?.note ?? providerLabel}
              >
                {providerLabel}
              </Badge>
              {turns.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearConversation}
                  disabled={busy}
                  title="Start a new conversation"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">New chat</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                title="Close assistant"
              >
                <X className="size-4" />
              </Button>
            </div>
          </header>

          {!accountReady ? (
            <div className="px-5 py-8 text-center" role="status">
              <p className="text-sm text-white/80">Checking your sign-in…</p>
              <p className="mt-1 text-xs muted">Your workspace stays private while we verify your session.</p>
            </div>
          ) : !account ? (
            <div className="px-5 py-7">
              <div className="mx-auto max-w-md text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/80">
                  <UserRound className="size-4" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-white">Sign in for a personal assistant</h3>
                <p className="mt-1.5 text-sm leading-relaxed muted">
                  The assistant can answer questions about your own requirements, offers, or provider profile after you sign in. It never receives another account&rsquo;s private workspace data.
                </p>
                <ButtonLink href={signInHref} size="sm" className="mt-4">
                  Sign in to continue
                </ButtonLink>
              </div>
            </div>
          ) : (
            <>
              <div
                className="max-h-[22rem] min-h-[13rem] space-y-3 overflow-y-auto px-4 py-4 sm:px-5"
                role="log"
                aria-label="Assistant conversation"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {turns.length === 0 ? (
                  <div>
                    <div className="flex gap-2.5">
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/5 text-white/75">
                        <Bot className="size-3.5" />
                      </span>
                      <div className="max-w-[35rem] rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-3">
                        <p className="text-sm leading-relaxed text-white/85">
                          I can help you make sense of your {role === "buyer" ? "requirements and incoming offers" : "open opportunities and your own bids"}, prepare a checklist, or improve your next procurement step. I won&rsquo;t submit or award anything for you.
                        </p>
                        <p className="mt-2 text-xs leading-relaxed faint">
                          {role === "buyer"
                            ? "For formal offer ranking, use the comparison workspace; its deterministic score stays authoritative."
                            : "I only see your provider profile, your own bids, and open opportunities in your trade—not competitor bids."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 pl-9">
                      {STARTERS[role].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void sendMessage(prompt)}
                          disabled={busy}
                          className="rounded-full border border-white/12 px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 pl-9">
                      <span className="mr-1 text-xs faint">Go to a built-in tool:</span>
                      {role === "buyer" ? (
                        <>
                          <ButtonLink href="/compare" size="sm" variant="ghost">
                            Compare offers
                          </ButtonLink>
                          <ButtonLink href="/post" size="sm" variant="ghost">
                            Parse a brief
                          </ButtonLink>
                        </>
                      ) : (
                        <ButtonLink href="/market" size="sm" variant="ghost">
                          Find a request · draft a bid
                        </ButtonLink>
                      )}
                    </div>
                  </div>
                ) : (
                  turns.map((turn) => (
                    <div
                      key={turn.id}
                      className={turn.role === "user" ? "flex justify-end" : "flex justify-start gap-2.5"}
                    >
                      {turn.role === "assistant" && (
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/5 text-white/75">
                          <Bot className="size-3.5" />
                        </span>
                      )}
                      <div
                        className={
                          turn.role === "user"
                            ? "max-w-[88%] rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm leading-relaxed text-white"
                            : "max-w-[88%] rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-sm leading-relaxed text-white/85 whitespace-pre-wrap"
                        }
                      >
                        {turn.content}
                      </div>
                      {turn.role === "user" && (
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 text-white/50">
                          <UserRound className="size-3.5" />
                        </span>
                      )}
                    </div>
                  ))
                )}

                {busy && (
                  <div className="flex items-center gap-2.5" role="status">
                    <span className="grid size-7 place-items-center rounded-lg border border-white/12 bg-white/5 text-white/70">
                      <Sparkles className="size-3.5 animate-pulse" />
                    </span>
                    <p className="rounded-xl border border-white/10 px-3.5 py-2.5 text-sm muted">
                      Checking your workspace and thinking…
                    </p>
                  </div>
                )}

                {error && (
                  <div className="ml-9 rounded-xl border border-white/15 bg-white/5 px-3.5 py-3" role="alert">
                    <p className="text-sm leading-relaxed text-white/80">{error}</p>
                    {failedMessage && account &&
                      (error.startsWith("Your session expired") ? (
                        <ButtonLink href={signInHref} size="sm" variant="ghost" className="mt-2">
                          Sign in again
                        </ButtonLink>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          onClick={() => void sendMessage(failedMessage, true)}
                          disabled={busy}
                        >
                          <RotateCcw className="size-3.5" /> Retry
                        </Button>
                      ))}
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {meta && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 px-4 py-2.5 text-[0.6875rem] faint sm:px-5">
                  <span className="inline-flex items-center gap-1.5">
                    {meta.mode === "llm" ? <Check className="size-3" /> : <ChevronDown className="size-3" />}
                    {meta.mode === "llm"
                      ? `Answered by ${meta.provider} (${meta.model}) in ${meta.latencyMs}ms`
                      : "No live model answered"}
                  </span>
                  {typeof meta.requirementsInContext === "number" && (
                    <span>{meta.requirementsInContext} {meta.requirementsInContext === 1 ? "requirement" : "requirements"} in context</span>
                  )}
                </div>
              )}

              <form onSubmit={submit} className="border-t border-white/10 px-4 py-3.5 sm:px-5">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void sendMessage(draft);
                      }
                    }}
                    placeholder={role === "buyer" ? "Ask about your requirements or offers…" : "Ask about your opportunities or bids…"}
                    className="field min-h-11 max-h-32 min-w-0 flex-1 resize-y py-2.5 text-sm leading-relaxed"
                    aria-label="Message for the assistant"
                    maxLength={4000}
                    rows={2}
                    disabled={busy}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={busy || !draft.trim()}
                    aria-label="Send message"
                    title="Send message"
                    className="w-11 shrink-0 px-0"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[0.6875rem] faint">
                  <span>Enter to send · Shift+Enter for a new line</span>
                  <span>{draft.length.toLocaleString()} / 4,000</span>
                </div>
                <p className="mt-2 text-[0.6875rem] leading-relaxed faint">
                  AI answers are suggestions. Verify details before acting; it cannot submit, award, or change marketplace records.
                </p>
              </form>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
