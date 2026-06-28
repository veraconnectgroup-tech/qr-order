import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { buildTurnEnvelope } from "@/lib/denis/platform/timeline-types";
import { buildPosInboundTimelineMessage } from "@/lib/pos/inbound/peer-cart";
import type { PosInboundOrderDraft } from "@/lib/pos/inbound/types";
import { markPosStaffEdit } from "@/lib/pos/session-edit-store";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncPosInboundToDenisInput = {
  tableSessionId: string;
  tableName: string;
  orderId: string;
  orderNumber: number;
  draft: PosInboundOrderDraft;
  language?: string;
};

async function resolveSharedAiSessionId(
  admin: SupabaseClient,
  tableSessionId: string
): Promise<string | null> {
  const { data } = await admin
    .from("table_sessions")
    .select("denis_shared_ai_session_id")
    .eq("id", tableSessionId)
    .maybeSingle();

  const row = data as { denis_shared_ai_session_id: string | null } | null;
  return row?.denis_shared_ai_session_id ?? null;
}

/** Append Denis timeline + staff-edit lock after POS inbound order (Prompt 39). */
export async function syncPosInboundToDenis(
  admin: SupabaseClient,
  input: SyncPosInboundToDenisInput
): Promise<{ timelineAppended: boolean; message: string }> {
  const message = buildPosInboundTimelineMessage({
    tableName: input.tableName,
    items: input.draft.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
    })),
    language: input.language,
  });

  await markPosStaffEdit(input.tableSessionId);

  const aiSessionId = await resolveSharedAiSessionId(admin, input.tableSessionId);
  if (!aiSessionId) {
    logger.info("POS inbound Denis sync skipped — no shared ai session", {
      tableSessionId: input.tableSessionId,
      orderId: input.orderId,
    });
    return { timelineAppended: false, message };
  }

  const envelope = buildTurnEnvelope("system");
  const row = await appendDenisTimelineEvent(admin, {
    aiSessionId,
    eventType: "realtime.ingested",
    traceId: envelope.traceId,
    payload: {
      type: "realtime.ingested",
      source: "pos.inbound",
      payload: {
        message,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        tableName: input.tableName,
        items: input.draft.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
        })),
      },
      envelope,
    },
  });

  return { timelineAppended: Boolean(row), message };
}
