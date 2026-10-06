import { z } from "zod";
import { buildCopilotContext } from "@/lib/server/copilot";
import { requireAccount } from "@/lib/server/authz";
import { listBids, listProviders, listRequirements, recordEvent } from "@/lib/server/repo";
import { chat, conversationPrompt, status, untrusted } from "@/lib/server/llm";
import { ApiError, clientKey, ok, rateLimit, readBody, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const messageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(12)
    .default([]),
});

/**
 * POST /api/ai/copilot — Next.js fallback for the role-aware Gemini assistant.
 *
 * Personal context is built on the server and narrowed to the signed-in
 * account. The browser can never choose another buyer's records or a seller's
 * competitor bids.
 */
export const POST = route(
  async (request: Request) => {
    const account = await requireAccount();
    rateLimit(clientKey(request, `ai:copilot:${account.id}`), 30, 60_000);
    const input = await readBody(request, messageSchema);

    const [requirements, bids, providers] = await Promise.all([
      listRequirements(),
      listBids(),
      listProviders(),
    ]);
    const context = buildCopilotContext(account, requirements, bids, providers);
    const persona = context.role === "buyer" ? "buyer" : "provider";

    let result;
    try {
      result = await chat<string>(
        [
          {
            role: "system",
            content: conversationPrompt(
              `You are XMARKET's practical ${persona} assistant inside a needs-first procurement marketplace. Buyers post requirements; providers send offers.\n\n` +
                `Use the signed-in user's ${persona} workspace context supplied with each question. Help with ordinary marketplace work: explain requirements and offer details, surface budget or timeline trade-offs, prepare questions and checklists, improve a brief or proposal, and explain which built-in XMARKET AI action is suited to a task. For a buyer, the built-in tools can parse a brief, assess an offer's semantic fit, and explain a shortlist; for a provider, the requirement view has a bid-drafting action. Do not claim to have run those actions unless their results are in the context.\n\n` +
                `Give practical, concise answers (usually two to four sentences; use bullets when they make a checklist clearer). When useful, cite the requirement title or offer/bid ID so the user can verify the detail. Separate general advice from facts in the account context. For facts missing from that context, say they are not available rather than guessing. You may make a provisional suggestion from the listed price, deadline, tags and status, but never present it as the official compatibility ranking: the deterministic XMARKET comparison engine remains authoritative. Never submit an offer, award a contract, change a status, or claim that an action was completed.\n\n` +
                (context.role === "buyer"
                  ? "Use only the signed-in buyer's requirements and incoming offers. Refer to providers by their listed public profile name, and do not invent a provider capability or quote."
                  : "Use only the signed-in seller's public profile, own bids, and open opportunities in their trade. No competitor offer data is included; do not claim to know a competitor's price, terms, or ranking."),
            ),
          },
          ...input.history.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
          {
            role: "user",
            content: [
              untrusted("signed-in workspace context", context.content),
              untrusted("user question", input.message),
            ].join("\n\n"),
          },
        ],
        { temperature: 0.4, maxTokens: 2400, noCache: true }
      );
    } catch (error) {
      const currentStatus = status();
      if (!currentStatus.live) {
        return ok({
          reply:
            "The assistant needs a live model to answer. Add GEMINI_API_KEY to .env.local and restart the app (and FastAPI service if you run it separately). Your marketplace data is unchanged.",
          meta: {
            provider: currentStatus.provider,
            model: currentStatus.model,
            mode: currentStatus.mode,
            cached: false,
            latencyMs: 0,
            requirementsInContext: context.requirementsInContext,
            role: context.role,
          },
        });
      }
      throw error;
    }

    const currentStatus = status();
    const reply =
      (typeof result.value === "string" ? result.value : String(result.value)).trim();
    if (!reply) {
      throw new ApiError("upstream", "The model returned an empty answer. Try a shorter question.");
    }

    await recordEvent({
      type: "ai.invoked",
      actor: "system",
      summary: `Marketplace assistant answered by ${result.provider} (${result.model})`,
      meta: {
        mode: "llm",
        cached: result.cached,
        latencyMs: result.latencyMs,
        role: context.role,
      },
    }).catch(() => undefined);

    return ok({
      reply,
      meta: {
        provider: result.provider,
        model: result.model,
        mode: currentStatus.mode,
        cached: result.cached,
        latencyMs: result.latencyMs,
        requirementsInContext: context.requirementsInContext,
        role: context.role,
      },
    });
  },
  "POST /api/ai/copilot"
);
