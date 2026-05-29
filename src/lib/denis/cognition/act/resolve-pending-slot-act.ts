import { finalizeOrderFlow } from "@/lib/ai/ordering/order-flow";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import {
  initDraftFromStorage,
  tryResolveQuickReply,
} from "@/lib/ai/ordering/draft-engine";
import type { ValidatedCartAction } from "@/lib/ai/ordering/draft-types";
import type { AiStructuredResponse } from "@/lib/ai/types";
import { normalizePendingSlotReply } from "@/lib/denis/cognition/act/fuzzy-slot-reply";
import type { PendingSlotKind } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import { aiOrderDraftToDenisCartState } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import { persistKernelOrderingDraft } from "@/lib/denis/runtime/act/apply-kernel-ordering";
import { logger } from "@/lib/logger";

export type PendingSlotActResult =
  | {
      resolved: true;
      sessionId: string;
      message: string;
      cartActions: ValidatedCartAction[];
      quickReplies: string[];
      intent: AiStructuredResponse["intent"];
      cartDraft: DenisCartDraft;
      structuredPerception: AiStructuredResponse;
    }
  | { resolved: false };

export type TryResolvePendingSlotActInput = {
  admin: SupabaseClient;
  sessionId: string;
  locationId: string;
  userMessage: string;
  language: string;
  pendingSlot: PendingSlotKind | string;
};

function serveSizeOptionsFromDraft(
  draft: ReturnType<typeof initDraftFromStorage>
): string[] {
  const pending = draft.pending;
  if (!pending) return [];
  for (const missing of pending.missing) {
    if (missing.kind === "serveSize") return missing.options;
  }
  return [];
}

function buildSlotFillConfirmation(
  actions: ValidatedCartAction[],
  language: string
): string {
  if (!actions.length) return "";
  const summary = actions
    .map((action) => {
      const size = action.serveSize ? ` ${action.serveSize}` : "";
      return `${action.quantity}× ${action.productName}${size}`;
    })
    .join(", ");

  if (language === "de") return `Eingetragen: ${summary}.`;
  if (language === "en") return `Added to cart: ${summary}.`;
  return `Dodato u korpu: ${summary}.`;
}

function attemptResolve(
  draft: ReturnType<typeof initDraftFromStorage>,
  catalog: Awaited<ReturnType<typeof getCachedMenuForLocation>>,
  replyText: string
) {
  return tryResolveQuickReply(draft, replyText, {
    menuText: catalog.menuText,
    productMap: catalog.productMap,
    catalog: catalog.catalog,
    currency: catalog.currency,
    cachedAt: catalog.cachedAt,
  });
}

/**
 * ADR-031 C2 — deterministic ACT for pending slot replies (0 credits).
 * Mutates ai_sessions.order_draft when resolved.
 */
export async function tryResolvePendingSlotAct(
  input: TryResolvePendingSlotActInput
): Promise<PendingSlotActResult> {
  const { data: sessionRow, error: sessionError } = await input.admin
    .from("ai_sessions")
    .select("order_draft")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return { resolved: false };
  }

  const draft = initDraftFromStorage(sessionRow.order_draft);
  if (!draft.pending) {
    return { resolved: false };
  }

  let catalog;
  try {
    catalog = await getCachedMenuForLocation(input.locationId, {
      useEnglish: false,
    });
  } catch (error) {
    logger.warn("Pending slot ACT catalog load failed", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { resolved: false };
  }

  const options = serveSizeOptionsFromDraft(draft);
  const candidates = [
    normalizePendingSlotReply(input.pendingSlot, input.userMessage, options),
    input.userMessage.trim(),
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  for (const replyText of candidates) {
    const resolved = attemptResolve(draft, catalog, replyText);
    if (!resolved?.cartActions.length) continue;

    const persist = await persistKernelOrderingDraft(
      input.admin,
      input.sessionId,
      resolved.draft
    );
    if (!persist.ok) {
      return { resolved: false };
    }

    const flowResult = finalizeOrderFlow({
      userMessage: input.userMessage,
      draft: resolved.draft,
      llmMessage: "",
      llmSubmitOrder: false,
      cartActionsThisTurn: resolved.cartActions.length,
      language: input.language,
    });

    const flowPersist = await persistKernelOrderingDraft(
      input.admin,
      input.sessionId,
      flowResult.draft
    );
    if (!flowPersist.ok) {
      return { resolved: false };
    }

    const message =
      flowResult.message ||
      buildSlotFillConfirmation(resolved.cartActions, input.language);
    const structuredPerception: AiStructuredResponse = {
      message,
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
      intent: "order",
    };

    const cartDraft =
      aiOrderDraftToDenisCartState(flowResult.draft).draft ?? {
        items: [],
        cartRevision: 0,
      };

    return {
      resolved: true,
      sessionId: input.sessionId,
      message,
      cartActions: resolved.cartActions,
      quickReplies: [],
      intent: "order",
      cartDraft,
      structuredPerception,
    };
  }

  return { resolved: false };
}

/** Whether order draft still has an unresolved pending slot. */
export async function sessionDraftHasPendingSlot(
  admin: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  const { data } = await admin
    .from("ai_sessions")
    .select("order_draft")
    .eq("id", sessionId)
    .maybeSingle();

  if (!data) return false;
  return Boolean(initDraftFromStorage(data.order_draft).pending);
}
