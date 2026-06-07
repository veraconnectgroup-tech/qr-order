import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import {
  buildSessionRhythmFacts,
  type SessionRhythmOrderRow,
} from "@/lib/commerce/projections/collect-session-rhythm-facts";
import { finalizeCommerceExperienceCommand } from "@/lib/commerce/runtime/finalize-command-rpc";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Append commerce.session.completed for VRP learning (ADR-042 P0). */
export async function projectSessionCompletedToCommerce(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    billStatus?: "settled" | "void";
    traceId?: string;
  }
): Promise<void> {
  const { data: session, error: sessionError } = await admin
    .from("table_sessions")
    .select("id, location_id, opened_at, closed_at, bill_status, status")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    logger.warn("projectSessionCompleted: session not found", {
      sessionId: input.sessionId,
      error: sessionError?.message,
    });
    return;
  }

  const sessionRow = session as {
    id: string;
    location_id: string;
    opened_at: string;
    closed_at: string | null;
    bill_status: string | null;
    status: string;
  };

  if (sessionRow.status !== "closed" || !sessionRow.closed_at) {
    return;
  }

  const billStatus =
    input.billStatus ??
    (sessionRow.bill_status === "void" ? "void" : "settled");

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("org_id, timezone")
    .eq("id", sessionRow.location_id)
    .maybeSingle();

  if (locationError || !location) {
    return;
  }

  const locationRow = location as { org_id: string; timezone: string | null };

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select(
      `
      id,
      status,
      total,
      payment_status,
      created_at,
      delivered_at,
      order_items (product_id, product_name, menu_section, quantity)
    `
    )
    .eq("session_id", sessionRow.id);

  if (ordersError) {
    logger.warn("projectSessionCompleted: orders load failed", {
      sessionId: input.sessionId,
      error: ordersError.message,
    });
    return;
  }

  const facts = buildSessionRhythmFacts({
    orgId: locationRow.org_id,
    locationId: sessionRow.location_id,
    sessionId: sessionRow.id,
    billStatus,
    openedAt: sessionRow.opened_at,
    closedAt: sessionRow.closed_at,
    timezone: locationRow.timezone?.trim() || "Europe/Berlin",
    orders: (orders ?? []) as SessionRhythmOrderRow[],
  });

  if (!facts) {
    return;
  }

  const idempotencyKey = `vrp:session-completed:${sessionRow.id}`;

  await finalizeCommerceExperienceCommand(admin, {
    orgId: facts.orgId,
    locationId: facts.locationId,
    sessionId: facts.sessionId,
    orderId: null,
    commandType: COMMERCE_COMMAND_TYPES.recordSessionCompleted,
    eventType: COMMERCE_EVENT_TYPES.sessionCompleted,
    payload: {
      slotKey: facts.slotKey,
      localDow: facts.localDow,
      localHour: facts.localHour,
      durationMin: facts.durationMin,
      dessertDelayMin: facts.dessertDelayMin,
      revenue: facts.revenue,
      topProducts: facts.topProducts,
      servicePeriod: facts.servicePeriod,
      closedAt: facts.closedAt,
    },
    idempotencyKey,
    traceId: input.traceId,
  });
}

export async function scheduleSessionCompletedCommerce(
  admin: SupabaseClient,
  sessionId: string,
  billStatus: "settled" | "void"
): Promise<void> {
  if (billStatus === "void") {
    return;
  }

  await projectSessionCompletedToCommerce(admin, { sessionId, billStatus });
}
