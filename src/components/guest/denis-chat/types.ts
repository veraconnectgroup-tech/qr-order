import type { ParsedApiError } from "@/lib/api-error-client";
import { ERROR_CODES } from "@/lib/api-error-client";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import { transcriptEntriesToChatMessages } from "@/lib/guest/view-transcript-bootstrap";
import type { TranscriptEntry } from "@/lib/denis/loop/view-types";
import type { MenuSection } from "@/lib/menu-section";
import {
  legacyTokensForAiSession,
} from "@/lib/ai/guest-ai-token";
import { useGuestSession } from "@/hooks/use-guest-session";

export type QuickPickOption = { id: string; label: string };

export type ChatQuickPicksConfig = {
  options: QuickPickOption[];
  mode: "multi" | "single";
  confirmed: boolean;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  quickPicks?: ChatQuickPicksConfig;
  quickReplies?: string[];
  quickRepliesUsed?: boolean;
  recommendations?: ProductRecommendation[];
  ephemeral?: boolean;
};

export type TurnExtras = {
  quickReplies?: string[];
  recommendations?: ProductRecommendation[];
};

export type ChatPhase = "allergies" | "mood" | "chat";

export type ValidatedCartAction = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  serveSize: string | null;
  menuSection: MenuSection;
  productTaxRate: number | null;
  modifiers: Array<{
    modifierId: string;
    modifierName: string;
    price: number;
  }>;
  lineTotal: number;
};

export function chatMessagesFromViewTranscript(
  transcript: TranscriptEntry[],
  options?: {
    turnExtras?: TurnExtras | null;
    usedQuickReplyIds?: ReadonlySet<string>;
    ephemeral?: ChatMessage[];
  }
): ChatMessage[] {
  const synced: ChatMessage[] = transcriptEntriesToChatMessages(transcript).map(
    (entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
    })
  );

  if (options?.turnExtras) {
    for (let i = synced.length - 1; i >= 0; i--) {
      if (synced[i].role !== "assistant") continue;
      synced[i] = {
        ...synced[i],
        quickReplies: options.turnExtras.quickReplies?.length
          ? options.turnExtras.quickReplies
          : undefined,
        recommendations: options.turnExtras.recommendations?.length
          ? options.turnExtras.recommendations
          : undefined,
        quickRepliesUsed: options.usedQuickReplyIds?.has(synced[i].id),
      };
      break;
    }
  } else if (options?.usedQuickReplyIds?.size) {
    for (let i = synced.length - 1; i >= 0; i--) {
      if (
        synced[i].role === "assistant" &&
        options.usedQuickReplyIds.has(synced[i].id)
      ) {
        synced[i] = { ...synced[i], quickRepliesUsed: true };
        break;
      }
    }
  }

  const transcriptKeys = new Set(
    synced.map((message) => `${message.role}:${message.content}`)
  );
  const keptLocal = (options?.ephemeral ?? []).filter(
    (message) => !transcriptKeys.has(`${message.role}:${message.content}`)
  );

  return [...synced, ...keptLocal];
}

export function mapAiChatError(
  parsed: ParsedApiError | null,
  status: number,
  tUI: (key: string) => string
): string {
  if (!parsed) return tUI("ai.overlay.error");

  switch (parsed.code) {
    case ERROR_CODES.RATE_LIMITED:
      return tUI("ai.overlay.rateLimited");
    case ERROR_CODES.MODERATION_BLOCKED:
      return tUI("ai.overlay.error");
    case ERROR_CODES.CREDIT_EXHAUSTED:
    case "insufficient_credits":
      return tUI("ai.overlay.noCredits");
    case ERROR_CODES.SESSION_EXPIRED:
    case ERROR_CODES.UNAUTHORIZED:
      return tUI("ai.overlay.sessionExpired");
    case ERROR_CODES.CIRCUIT_OPEN:
    case ERROR_CODES.INTERNAL:
      return tUI("ai.recovery.connection");
    case ERROR_CODES.INVALID_INPUT:
      return parsed.message || tUI("ai.overlay.error");
    default:
      break;
  }

  const details = parsed.details as { code?: string } | undefined;
  if (details?.code === "not_configured" || parsed.message.includes("not configured")) {
    return tUI("ai.overlay.unavailable");
  }
  if (parsed.message.includes("not enabled")) {
    return tUI("ai.overlay.unavailable");
  }
  if (status === 502 || status === 504) {
    return tUI("ai.recovery.connection");
  }
  if (
    parsed.message === "signal_timeout" ||
    parsed.message === "signal_processing_failed" ||
    parsed.message === "signal_failed"
  ) {
    return tUI("ai.recovery.connection");
  }

  return parsed.message || tUI("ai.overlay.error");
}

export function aiLegacySessionTokens(
  tableId: string,
  sessionToken: string | null | undefined
) {
  return legacyTokensForAiSession(
    tableId,
    sessionToken,
    useGuestSession.getState().tableId
  );
}

export function isStaleAiSessionResponse(
  status: number,
  parsed: ParsedApiError | null,
  sessionId: string | undefined
) {
  if (!sessionId) return false;
  if (parsed?.code === ERROR_CODES.SESSION_EXPIRED) return true;
  if (status === 401 || status === 404 || status === 410) return true;
  return (
    parsed?.message.includes("no longer active") === true ||
    parsed?.message.includes("message limit") === true
  );
}

export function nextChatMessageId() {
  return crypto.randomUUID();
}

export function formatDenisPinMessage(
  tUI: (key: string, vars?: Record<string, string | number>) => string,
  tablePin: string
) {
  return tUI("ai.order.tablePinReveal", { pin: tablePin });
}

export const CHAT_FETCH_TIMEOUT_MS = 58_000;
