import type { SupabaseClient } from "@supabase/supabase-js";
import { clearedDraftAfterSubmit } from "@/lib/denis/cognition/order";
import { toJson } from "@/lib/supabase/json";
import {
  emitDenisSessionConverted,
  emitDenisSessionUpdated,
} from "@/lib/webhooks/emit-denis-session-events";
import { logger } from "@/lib/logger";

/** Clear AI draft + link order after ACL submit (act path + unified turn submit). */
export async function persistAiSessionAfterOrderSubmit(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    orderId: string;
    orderNumber?: number;
    awaitingApproval?: boolean;
    source?: string;
  }
): Promise<void> {
  const { data: sessionRow, error: loadError } = await admin
    .from("ai_sessions")
    .select("linked_order_ids")
    .eq("id", input.aiSessionId)
    .maybeSingle();

  if (loadError || !sessionRow) {
    logger.error("Post-submit session load failed", {
      aiSessionId: input.aiSessionId,
      error: loadError?.message,
    });
    return;
  }

  const previousLinked =
    (sessionRow as { linked_order_ids: string[] }).linked_order_ids ?? [];
  const isFirstOrder = previousLinked.length === 0;

  const linkedIds = [
    ...new Set([...previousLinked, input.orderId]),
  ];

  const { error: updateError } = await admin
    .from("ai_sessions")
    .update({
      order_draft: toJson(clearedDraftAfterSubmit()),
      linked_order_ids: linkedIds,
    })
    .eq("id", input.aiSessionId);

  if (updateError) {
    logger.error("Post-submit draft clear failed", {
      aiSessionId: input.aiSessionId,
      orderId: input.orderId,
      error: updateError.message,
    });
  }

  await admin.from("ai_order_events").insert({
    ai_session_id: input.aiSessionId,
    order_id: input.orderId,
    event_type: "order_created",
    payload: {
      orderNumber: input.orderNumber,
      awaitingApproval: input.awaitingApproval ?? false,
      source: input.source ?? "denis_acl",
    },
  });

  if (isFirstOrder) {
    await emitDenisSessionConverted(admin, {
      aiSessionId: input.aiSessionId,
      orderId: input.orderId,
    });
  }

  const { data: tableSession } = await admin
    .from("table_sessions")
    .select("id")
    .eq("denis_shared_ai_session_id", input.aiSessionId)
    .maybeSingle();

  const tableSessionId = (tableSession as { id: string } | null)?.id;
  if (tableSessionId) {
    await emitDenisSessionUpdated(admin, {
      tableSessionId,
      updateReason: "order_submitted",
    });
  }
}
