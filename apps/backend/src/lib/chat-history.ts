// ============================================================================
// Chat-history storage for the natural-language campaign-editing flow
// (plan.md Open Item 20, Parts A/B). Backs lib/campaign-agent.ts's optional
// `history: ChatTurn[]` param with Workers KV, per plan.md's "Chat-history
// storage" decision (KV over Durable Objects/a new D1 table -- see that
// decision for the full comparison). campaign-agent.ts itself is stateless
// per call and never touches KV directly; this file is what routes/business.ts's
// POST /campaign/chat route uses to load a session's prior turns before
// calling the parser, and to persist the new turns afterward.
//
// Keyed `chat:{campaignId}:{sessionId}` (campaignId first, matching the key
// pattern already recorded in plan.md and in this business's ensureCampaign
// model of "one current campaign per business") with a short TTL so old
// sessions self-clean with no manual cleanup job -- appropriate given a
// clarification exchange only needs to survive a few minutes to at most a
// couple hours, not indefinitely like the rest of the app's D1-backed data.
// ============================================================================

import type { Env } from "../types";
import type { ChatTurn } from "./campaign-agent";

// ~1 hour, per plan.md's decision ("on the order of an hour").
export const CHAT_HISTORY_TTL_SECONDS = 60 * 60;

function chatHistoryKey(campaignId: string, sessionId: string): string {
  return `chat:${campaignId}:${sessionId}`;
}

/**
 * Loads the prior turns for a chat session. Returns an empty array (never
 * throws) for a missing/expired/malformed key -- a session with no history
 * yet is simply the start of a new conversation, not an error.
 */
export async function loadChatHistory(env: Env, campaignId: string, sessionId: string): Promise<ChatTurn[]> {
  const raw = await env.CHAT_HISTORY.get(chatHistoryKey(campaignId, sessionId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ChatTurn[];
  } catch {
    return [];
  }
}

/**
 * Appends one or more turns to a session's history and rewrites the key with
 * a fresh TTL (so an active back-and-forth keeps extending its own life,
 * rather than expiring mid-conversation on a fixed wall-clock schedule from
 * the first turn).
 */
export async function appendChatTurns(
  env: Env,
  campaignId: string,
  sessionId: string,
  newTurns: ChatTurn[]
): Promise<void> {
  const existing = await loadChatHistory(env, campaignId, sessionId);
  const updated = [...existing, ...newTurns];
  await env.CHAT_HISTORY.put(chatHistoryKey(campaignId, sessionId), JSON.stringify(updated), {
    expirationTtl: CHAT_HISTORY_TTL_SECONDS,
  });
}
