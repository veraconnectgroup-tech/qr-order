import { z } from "zod";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { apiError, apiSuccess } from "@/lib/api-response";
import { emitDenisSessionCompleted } from "@/lib/webhooks/emit-denis-session-events";
import { logger } from "@/lib/logger";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const conversionSchema = z.object({
  sessionId: zUuid(),
  productId: zUuid(),
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
});

export async function handleAiConversion(body: unknown) {
  const parsed = conversionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const guestContext = await verifyAiGuestContext(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.sessionToken,
  });

  if ("error" in guestContext) {
    return apiError(guestContext.error, guestContext.status);
  }

  const { data: session, error: loadError } = await admin
    .from("ai_sessions")
    .select("id, org_id, location_id, table_id, session_token, products_added, conversion_count, status")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (loadError) {
    logger.error("AI conversion session load failed", { error: loadError.message });
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
    session_token: string;
    products_added: string[];
    conversion_count: number;
    status: string;
  };

  if (
    row.org_id !== guestContext.data.orgId ||
    row.location_id !== input.locationId ||
    row.table_id !== input.tableId ||
    row.session_token !== input.sessionToken
  ) {
    return apiError("Unauthorized.", 401);
  }

  if (row.status !== "active") {
    return apiError("Session is not active.", 410);
  }

  if (row.products_added.includes(input.productId)) {
    return apiSuccess({ conversionCount: row.conversion_count });
  }

  const productsAdded = [...row.products_added, input.productId];
  const conversionCount = row.conversion_count + 1;

  const { error: updateError } = await admin
    .from("ai_sessions")
    .update({
      products_added: productsAdded,
      conversion_count: conversionCount,
    })
    .eq("id", row.id);

  if (updateError) {
    logger.error("AI conversion update failed", { error: updateError.message });
    return apiError("Could not record conversion.", 500);
  }

  return apiSuccess({ conversionCount });
}

const completeSchema = z.object({
  sessionId: zUuid(),
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
});

export async function handleAiSessionComplete(body: unknown) {
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const guestContext = await verifyAiGuestContext(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.sessionToken,
  });

  if ("error" in guestContext) {
    return apiError(guestContext.error, guestContext.status);
  }

  const { error } = await admin
    .from("ai_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId)
    .eq("session_token", input.sessionToken)
    .eq("status", "active");

  if (error) {
    logger.error("AI session complete failed", { error: error.message });
    return apiError("Could not complete session.", 500);
  }

  const { data: tableSession } = await admin
    .from("table_sessions")
    .select("id")
    .eq("denis_shared_ai_session_id" as never, input.sessionId)
    .maybeSingle();

  if (tableSession) {
    await emitDenisSessionCompleted(admin, {
      tableSessionId: (tableSession as { id: string }).id,
    });
  }

  return apiSuccess({ ok: true });
}
