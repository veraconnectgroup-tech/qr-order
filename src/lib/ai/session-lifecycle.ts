import { AI_CONFIG } from "@/lib/ai/config";

type SessionLike = {
  id: string;
  status: string;
  created_at: string;
  messages: unknown[];
};

export function isAiSessionExpired(session: SessionLike, now = Date.now()) {
  const created = new Date(session.created_at).getTime();
  return now - created > AI_CONFIG.sessionTimeoutMs;
}

export function isAiSessionMessageLimitReached(session: SessionLike) {
  return session.messages.length >= AI_CONFIG.maxMessagesPerSession;
}

export function aiSessionInactiveStatus(session: SessionLike) {
  if (session.status !== "active") return session.status;
  if (isAiSessionExpired(session)) return "expired";
  if (isAiSessionMessageLimitReached(session)) return "completed";
  return "active";
}
