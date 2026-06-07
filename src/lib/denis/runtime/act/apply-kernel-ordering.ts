import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplyOrderComprehendResult } from "@/lib/denis/cognition/order";
import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import { logger } from "@/lib/logger";

/** Persist kernel ordering draft to ai_sessions (F8-2). */
export async function persistKernelOrderingDraft(
  admin: SupabaseClient,
  aiSessionId: string,
  draft: AiOrderDraft
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin
    .from("ai_sessions")
    .update({
      order_draft: draft as unknown as import("@/types/database").Json,
    })
    .eq("id", aiSessionId);

  if (error) {
    logger.error("Kernel ordering session update failed", {
      aiSessionId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export type KernelOrderingMerge = {
  message: string;
  cartActions: ApplyOrderComprehendResult["cartActions"];
  quickReplies: string[];
  intent: string;
  submitOrder: boolean;
};

export function mergeKernelOrderingIntoTurn(
  legacyMessage: string,
  kernel: ApplyOrderComprehendResult
): KernelOrderingMerge {
  return {
    message: kernel.assistantMessage || legacyMessage,
    cartActions: kernel.cartActions,
    quickReplies: kernel.quickReplies,
    intent: kernel.intent,
    submitOrder: kernel.submitOrder,
  };
}
