/**
 * ADR-045 S2 — per-table Day Close sweeps for shift-tier registry entries.
 * Each function is idempotent for its own scope (location-scoped).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function closeOpenBusObligationsForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("table_bus_obligations")
    .update({ status: "cancelled" })
    .eq("location_id", locationId)
    .eq("status", "open")
    .select("id");

  if (error) {
    logger.warn("closeOpenBusObligationsForLocation failed", {
      locationId,
      error: error.message,
    });
    return 0;
  }

  const count = (data ?? []).length;
  if (count > 0) {
    logger.info("Day close cancelled open bus obligations", {
      locationId,
      count,
      at: now,
    });
  }
  return count;
}

export async function closeOpenWaiterCallsForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("waiter_calls")
    .update({ status: "resolved", resolved_at: now })
    .eq("location_id", locationId)
    .in("status", ["pending", "acknowledged"])
    .select("id");

  if (error) {
    logger.warn("closeOpenWaiterCallsForLocation failed", {
      locationId,
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).length;
}

/** Shift hints do not carry across days — delete all active rows for the location. */
export async function deleteShiftStaffTableHintsForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<number> {
  const { data, error } = await admin
    .from("denis_staff_table_hints" as never)
    .delete()
    .eq("location_id", locationId)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    logger.warn("deleteShiftStaffTableHintsForLocation failed", {
      locationId,
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).length;
}

/** Cancel pending/processing schedules; purge finished rows for this location. */
export async function purgeDenisSchedulesForDayClose(
  admin: SupabaseClient,
  locationId: string
): Promise<{ cancelled: number; deleted: number }> {
  const now = new Date().toISOString();
  let cancelled = 0;
  let deleted = 0;

  const { data: cancelledRows, error: cancelError } = await admin
    .from("denis_schedules")
    .update({ status: "cancelled", processed_at: now })
    .eq("location_id", locationId)
    .in("status", ["pending", "processing"])
    .select("id");

  if (cancelError) {
    logger.warn("purgeDenisSchedulesForDayClose cancel failed", {
      locationId,
      error: cancelError.message,
    });
  } else {
    cancelled = (cancelledRows ?? []).length;
  }

  const { data: deletedRows, error: deleteError } = await admin
    .from("denis_schedules")
    .delete()
    .eq("location_id", locationId)
    .in("status", ["completed", "cancelled"])
    .select("id");

  if (deleteError) {
    logger.warn("purgeDenisSchedulesForDayClose delete failed", {
      locationId,
      error: deleteError.message,
    });
  } else {
    deleted = (deletedRows ?? []).length;
  }

  return { cancelled, deleted };
}
