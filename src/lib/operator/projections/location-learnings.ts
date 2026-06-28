import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateLocationLearnings } from "@/lib/denis/learning/aggregate-location-learnings";
import type { HistoricalOrderRow } from "@/lib/denis/config/basket-pair-types";
import {
  parseOperatorPeriod,
  periodToIsoRange,
} from "@/lib/operator/parse-period";
import type { OperatorLocationLearnings, OperatorPeriod } from "@/lib/operator/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export async function projectLocationLearnings(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    period?: OperatorPeriod | string | null;
  }
): Promise<OperatorLocationLearnings | null> {
  const bounds = parseOperatorPeriod(input.period ?? "7d");
  const range = periodToIsoRange(bounds);

  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("id", input.locationId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!location) return null;

  const { data: tableSessions } = await admin
    .from("table_sessions")
    .select("id, denis_shared_ai_session_id")
    .eq("location_id", input.locationId)
    .gte("opened_at", range.from)
    .lte("opened_at", range.to);

  const aiSessionIds = [
    ...new Set(
      (tableSessions ?? [])
        .map(
          (row) =>
            (row as { denis_shared_ai_session_id: string | null })
              .denis_shared_ai_session_id
        )
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let timeline: DenisTimelineRow[] = [];
  if (aiSessionIds.length > 0) {
    const { data: timelineRows } = await admin
      .from("denis_timeline")
      .select(
        "id, ai_session_id, seq, event_type, payload, trace_id, context_hash, created_at"
      )
      .in("ai_session_id", aiSessionIds)
      .gte("created_at", range.from)
      .lte("created_at", range.to)
      .order("seq", { ascending: true });

    timeline = (timelineRows ?? []) as DenisTimelineRow[];
  }

  const { data: orderData } = await admin
    .from("orders")
    .select("session_id, order_items(product_id, product_name)")
    .eq("location_id", input.locationId)
    .eq("status", "delivered")
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .limit(5000);

  const orderRows: HistoricalOrderRow[] = [];
  for (const order of orderData ?? []) {
    const row = order as {
      session_id: string | null;
      order_items: Array<{ product_id: string; product_name: string }>;
    };
    const tableSessionId = row.session_id;
    if (!tableSessionId) continue;
    for (const item of row.order_items ?? []) {
      if (!item.product_id) continue;
      orderRows.push({
        tableSessionId,
        productId: item.product_id,
        productName: item.product_name,
      });
    }
  }

  const aggregates = aggregateLocationLearnings({ timeline, orderRows });

  return {
    locationId: input.locationId,
    period: range,
    ...aggregates,
  };
}
