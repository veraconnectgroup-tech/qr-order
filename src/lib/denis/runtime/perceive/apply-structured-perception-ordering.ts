import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { applyOrderComprehend } from "@/lib/denis/cognition/order";
import type { AiStructuredResponse } from "@/lib/ai/types";
import { aiOrderDraftToDenisCartState } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import {
  mergeKernelOrderingIntoTurn,
  persistKernelOrderingDraft,
} from "@/lib/denis/runtime/act/apply-kernel-ordering";
import { timelineToStoredMessages } from "@/lib/denis/loop/fold-transcript";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import { logger } from "@/lib/logger";

export type ApplyStructuredPerceptionOrderingInput = {
  admin: SupabaseClient;
  sessionId: string;
  locationId: string;
  userMessage: string;
  language: string;
  structured: AiStructuredResponse;
  timelineEnabled: boolean;
  fallbackDraft: DenisCartDraft;
  traceId?: string;
};

export type ApplyStructuredPerceptionOrderingResult = {
  message: string;
  cartActions: ReturnType<typeof applyOrderComprehend>["cartActions"];
  quickReplies: string[];
  intent: string;
  submitOrder: boolean;
  cartDraft: DenisCartDraft;
};

/** ADR-019 G4 — Denis loop applies LLM perception to cart (not legacy adapter). */
export async function applyStructuredPerceptionOrdering(
  input: ApplyStructuredPerceptionOrderingInput
): Promise<ApplyStructuredPerceptionOrderingResult | null> {
  const { data: sessionRow, error: sessionError } = await input.admin
    .from("ai_sessions")
    .select("order_draft")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    logger.warn("Structured perception ordering session load failed", {
      traceId: input.traceId,
      sessionId: input.sessionId,
      error: sessionError?.message,
    });
    return null;
  }

  try {
    const menuPayload = await getCachedMenuForLocation(input.locationId, {
      useEnglish: false,
    });
    const catalog = {
      menuText: menuPayload.menuText,
      productMap: menuPayload.productMap,
      catalog: menuPayload.catalog,
      currency: menuPayload.currency,
      cachedAt: menuPayload.cachedAt,
    };

    const priorMessages: Array<{ role: "user" | "assistant"; content: string }> =
      timelineToStoredMessages(
        await loadDenisTimeline(input.admin, input.sessionId)
      );

    const kernel = applyOrderComprehend({
      userMessage: input.userMessage,
      allowOrdering: true,
      orderDraft: initDraftFromStorage(sessionRow.order_draft),
      catalog,
      structured: input.structured,
      priorMessages,
      language: input.language,
    });

    await persistKernelOrderingDraft(input.admin, input.sessionId, kernel.draft);

    const cartDraft =
      aiOrderDraftToDenisCartState(kernel.draft).draft ?? input.fallbackDraft;
    const merged = mergeKernelOrderingIntoTurn("", kernel);

    return {
      message: merged.message,
      cartActions: merged.cartActions,
      quickReplies: merged.quickReplies,
      intent: merged.intent,
      submitOrder: merged.submitOrder,
      cartDraft,
    };
  } catch (error) {
    logger.warn("Structured perception ordering failed", {
      traceId: input.traceId,
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
