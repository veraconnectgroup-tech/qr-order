import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { OrderFact } from "@/lib/denis/loop/types";
import {
  processGuestStatusInquiry,
  type GuestStatusInquiryResult,
} from "@/lib/denis/stations/process-guest-status-inquiry";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isGuestStatusTurnReason(
  reason: string | null | undefined
): boolean {
  if (!reason) return false;
  const base = reason.replace(/\.llm_reply$/, "");
  return (
    base === "commerce.status.open_order" ||
    base === "commerce.post_order.settling"
  );
}

/** Phase 1 intel + optional station ticket before LLM narrates like a waiter. */
export async function maybeProcessGuestStatusForTurn(
  admin: SupabaseClient,
  input: {
    turnPlanReason: string | null | undefined;
    locationId: string;
    tableId: string;
    tableName: string | null;
    orders: OrderFact[];
    venueOps?: VenueOpsBeliefs | null;
    config: ConciergeConfig;
  }
): Promise<GuestStatusInquiryResult | null> {
  if (!isGuestStatusTurnReason(input.turnPlanReason)) return null;
  if (input.orders.length === 0) return null;

  return processGuestStatusInquiry(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    tableName: input.tableName,
    orders: input.orders,
    venueOps: input.venueOps,
    config: input.config,
  });
}
