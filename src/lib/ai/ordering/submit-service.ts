import {
  clearedDraftAfterSubmit,
  submitAiOrderDraft,
} from "@/lib/ai/ordering/order-executor";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function handleAiOrderSubmit(input: {
  sessionId: string;
  locationId: string;
  tableId: string;
  tableToken: string;
  sessionToken?: string;
  deviceFingerprint: string;
  deviceToken?: string;
}) {
  const admin = createAdminClient();

  const guestContext = await verifyAiGuestContext(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.tableToken,
  });

  if ("error" in guestContext) {
    return apiError(guestContext.error, guestContext.status);
  }

  const { data: session, error: sessionError } = await admin
    .from("ai_sessions")
    .select("id, org_id, location_id, table_id, order_draft, linked_order_ids, status")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError) {
    logger.error("AI session load for submit failed", {
      error: sessionError.message,
    });
    return apiError("Could not load session.", 500);
  }

  if (!session) {
    return apiError("Session not found.", 404);
  }

  const row = session as {
    id: string;
    org_id: string;
    location_id: string;
    table_id: string;
    order_draft: unknown;
    linked_order_ids: string[];
    status: string;
  };

  if (
    row.org_id !== guestContext.data.orgId ||
    row.location_id !== input.locationId ||
    row.table_id !== input.tableId
  ) {
    return apiError("Unauthorized.", 401);
  }

  if (row.status !== "active") {
    return apiError("Session is no longer active.", 410);
  }

  const draft = initDraftFromStorage(row.order_draft);

  let catalog;
  try {
    catalog = await getCachedMenuForLocation(input.locationId);
  } catch {
    return apiError("Menu could not be loaded.", 500);
  }

  const result = await submitAiOrderDraft({
    aiSessionId: row.id,
    tableToken: input.tableToken,
    sessionToken: input.sessionToken,
    deviceFingerprint: input.deviceFingerprint,
    deviceToken: input.deviceToken,
    draft,
    catalog: {
      menuText: catalog.menuText,
      productMap: catalog.productMap,
      catalog: catalog.catalog,
      currency: catalog.currency,
      cachedAt: catalog.cachedAt,
    },
  });

  if ("error" in result) {
    return apiError(result.error, result.status, {
      blockedUntil: result.blockedUntil,
    });
  }

  const linkedIds = [...new Set([...row.linked_order_ids, result.data.orderId])];

  await admin
    .from("ai_sessions")
    .update({
      order_draft: clearedDraftAfterSubmit() as unknown as import("@/types/database").Json,
      linked_order_ids: linkedIds,
    })
    .eq("id", row.id);

  await admin.from("ai_order_events").insert({
    ai_session_id: row.id,
    order_id: result.data.orderId,
    event_type: "order_created",
    payload: {
      orderNumber: result.data.orderNumber,
      awaitingApproval: result.data.awaitingApproval ?? false,
    },
  });

  return apiSuccess({
    orderId: result.data.orderId,
    orderNumber: result.data.orderNumber,
    total: result.data.total,
    awaitingApproval: result.data.awaitingApproval ?? false,
    sessionOpened: result.data.sessionOpened,
  });
}
