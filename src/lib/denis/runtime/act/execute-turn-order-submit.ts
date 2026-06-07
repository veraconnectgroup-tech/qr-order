import type { SupabaseClient } from "@supabase/supabase-js";
import { initDraftFromStorage } from "@/lib/denis/cognition/order";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { executeDenisOrderCommand } from "@/lib/denis/acl/execute-denis-order-command";
import {
  buildDenisOrderCommand,
  reconcileCartDraftPricesFromCatalog,
} from "@/lib/denis/runtime/act/build-order-command";
import { ensureTrustedDeviceForDenisSubmit } from "@/lib/denis/runtime/act/ensure-trusted-device";
import { persistAiSessionAfterOrderSubmit } from "@/lib/denis/runtime/act/persist-ai-session-after-order-submit";
import {
  actSubmitGuestBlockedMessage,
  type ActSubmitOutcome,
} from "@/lib/denis/runtime/act/resolve-act-submit-outcome";
import { aiOrderDraftToDenisCartState } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import { logger } from "@/lib/logger";

export type TurnOrderSubmitInput = {
  aiSessionId: string;
  locationId: string;
  tableToken: string;
  sessionToken?: string;
  deviceFingerprint?: string;
  deviceToken?: string;
  cartDraft: DenisCartDraft;
};

/** ADR-019 G2 — server-side ACL submit during turn (no guest /api/ai/order/submit). */
export async function executeTurnOrderSubmit(
  admin: SupabaseClient,
  input: TurnOrderSubmitInput
): Promise<ActSubmitOutcome> {
  if (!input.deviceFingerprint) {
    return {
      attempted: true,
      submitError: "missing_submit_context",
      guestBlockedReason: actSubmitGuestBlockedMessage("missing_submit_context"),
    };
  }

  let cartDraft = input.cartDraft;

  const { data: sessionRow, error: sessionError } = await admin
    .from("ai_sessions")
    .select("order_draft, linked_order_ids, status")
    .eq("id", input.aiSessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    logger.error("Turn order submit session load failed", {
      aiSessionId: input.aiSessionId,
      error: sessionError?.message,
    });
    return {
      attempted: true,
      submitError: "missing_submit_context",
      guestBlockedReason: actSubmitGuestBlockedMessage("missing_submit_context"),
    };
  }

  const row = sessionRow as {
    order_draft: unknown;
    linked_order_ids: string[];
    status: string;
  };

  if (row.status !== "active") {
    return {
      attempted: true,
      submitError: "session_inactive",
      guestBlockedReason: actSubmitGuestBlockedMessage("submit_failed"),
    };
  }

  if (!cartDraft.items.length) {
    cartDraft = aiOrderDraftToDenisCartState(
      initDraftFromStorage(row.order_draft)
    ).draft;
  }

  if (!cartDraft.items.length) {
    return {
      attempted: true,
      submitError: "empty_cart",
      guestBlockedReason: actSubmitGuestBlockedMessage("empty_cart"),
    };
  }

  let catalog;
  try {
    const menuPayload = await getCachedMenuForLocation(input.locationId);
    catalog = {
      menuText: menuPayload.menuText,
      productMap: menuPayload.productMap,
      catalog: menuPayload.catalog,
      currency: menuPayload.currency,
      cachedAt: menuPayload.cachedAt,
    };
  } catch (error) {
    logger.warn("Turn order submit catalog load failed", {
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      attempted: true,
      submitError: "catalog_unavailable",
      guestBlockedReason: actSubmitGuestBlockedMessage("submit_failed"),
    };
  }

  const pricedCart = reconcileCartDraftPricesFromCatalog(cartDraft, catalog);

  const trusted = await ensureTrustedDeviceForDenisSubmit(admin, {
    tableToken: input.tableToken,
    sessionToken: input.sessionToken,
    deviceFingerprint: input.deviceFingerprint,
    deviceToken: input.deviceToken,
  });
  if ("error" in trusted) {
    return {
      attempted: true,
      submitError: trusted.error,
      guestBlockedReason: actSubmitGuestBlockedMessage(trusted.error),
    };
  }

  const command = buildDenisOrderCommand({
    aiSessionId: input.aiSessionId,
    tableToken: input.tableToken,
    sessionToken: input.sessionToken,
    deviceFingerprint: input.deviceFingerprint,
    deviceToken: trusted.deviceToken,
    cartDraft: pricedCart,
  });

  if (!command) {
    return {
      attempted: true,
      submitError: "empty_cart",
      guestBlockedReason: actSubmitGuestBlockedMessage("empty_cart"),
    };
  }

  const result = await executeDenisOrderCommand({ command, catalog });

  if (!result.ok) {
    return {
      attempted: true,
      submitError: result.error,
      guestBlockedReason: actSubmitGuestBlockedMessage(result.error),
    };
  }

  await persistAiSessionAfterOrderSubmit(admin, {
    aiSessionId: input.aiSessionId,
    orderId: result.data.orderId,
    orderNumber: result.data.orderNumber,
    awaitingApproval: result.data.awaitingApproval,
    source: "denis_turn_acl",
  });

  return {
    attempted: true,
    orderId: result.data.orderId,
    orderNumber: result.data.orderNumber,
    awaitingApproval: result.data.awaitingApproval,
    sessionOpened: result.data.sessionOpened,
  };
}
