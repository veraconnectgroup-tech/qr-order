/**
 * Denis Day Close pipeline (ADR-045 §4.2, session S2).
 *
 * Runs after the existing fiscal daily closing / daily report for a
 * location+business_date. Iterates the memory registry's dayClose entries
 * and closes out whatever the registry says should close (today: open
 * station_questions → expired, reason "day_close"). Idempotent — a repeat
 * call for the same location+date is a no-op, recorded via the unique
 * (location_id, business_date) row in denis_day_closes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  closeOpenBusObligationsForLocation,
  closeOpenWaiterCallsForLocation,
  deleteShiftStaffTableHintsForLocation,
  purgeDenisSchedulesForDayClose,
} from "@/lib/denis/memory/day-close-sweeps";
import { entriesForDayClose } from "@/lib/denis/memory/memory-registry";
import {
  expireStationQuestionTurns,
  expireStationQuestions,
} from "@/lib/denis/stations/station-questions";
import { logger } from "@/lib/logger";

export type DayCloseSummary = {
  processed: string[];
  skipped: string[];
  expiredStationQuestions: number;
  expiredStationQuestionTurns: number;
  cancelledBusObligations: number;
  resolvedWaiterCalls: number;
  deletedStaffTableHints: number;
  cancelledSchedules: number;
  deletedSchedules: number;
};

export type RunDenisDayCloseResult = {
  alreadyClosed: boolean;
  summary: DayCloseSummary;
};

export async function runDenisDayClose(
  admin: SupabaseClient,
  input: { locationId: string; businessDate: string }
): Promise<RunDenisDayCloseResult> {
  const { data: existing, error: lookupError } = await admin
    .from("denis_day_closes")
    .select("summary")
    .eq("location_id", input.locationId)
    .eq("business_date", input.businessDate)
    .maybeSingle();

  if (lookupError) {
    logger.warn("runDenisDayClose lookup failed", {
      locationId: input.locationId,
      businessDate: input.businessDate,
      error: lookupError.message,
    });
  }

  if (existing) {
    logger.info("Denis day close already recorded — no-op", {
      locationId: input.locationId,
      businessDate: input.businessDate,
    });
    return {
      alreadyClosed: true,
      summary: (existing as { summary: DayCloseSummary }).summary,
    };
  }

  const summary: DayCloseSummary = {
    processed: [],
    skipped: [],
    expiredStationQuestions: 0,
    expiredStationQuestionTurns: 0,
    cancelledBusObligations: 0,
    resolvedWaiterCalls: 0,
    deletedStaffTableHints: 0,
    cancelledSchedules: 0,
    deletedSchedules: 0,
  };

  for (const entry of entriesForDayClose()) {
    if (entry.dayClose === "close" && entry.table === "station_questions") {
      summary.expiredStationQuestions += await expireStationQuestions(admin, {
        locationId: input.locationId,
        reason: "day_close",
      });
      summary.processed.push(entry.table);
      continue;
    }

    if (entry.dayClose === "close" && entry.table === "station_question_turns") {
      summary.expiredStationQuestionTurns += await expireStationQuestionTurns(admin, {
        locationId: input.locationId,
        retentionDays: entry.retentionDays ?? 1,
      });
      summary.processed.push(entry.table);
      continue;
    }

    if (entry.dayClose === "close" && entry.table === "table_bus_obligations") {
      summary.cancelledBusObligations += await closeOpenBusObligationsForLocation(
        admin,
        input.locationId
      );
      summary.processed.push(entry.table);
      continue;
    }

    if (entry.dayClose === "close" && entry.table === "waiter_calls") {
      summary.resolvedWaiterCalls += await closeOpenWaiterCallsForLocation(
        admin,
        input.locationId
      );
      summary.processed.push(entry.table);
      continue;
    }

    if (entry.dayClose === "delete" && entry.table === "denis_staff_table_hints") {
      summary.deletedStaffTableHints += await deleteShiftStaffTableHintsForLocation(
        admin,
        input.locationId
      );
      summary.processed.push(entry.table);
      continue;
    }

    if (entry.dayClose === "delete" && entry.table === "denis_schedules") {
      const scheduleResult = await purgeDenisSchedulesForDayClose(
        admin,
        input.locationId
      );
      summary.cancelledSchedules += scheduleResult.cancelled;
      summary.deletedSchedules += scheduleResult.deleted;
      summary.processed.push(entry.table);
      continue;
    }

    // rollup: ADR-042 rhythm rollup runs on its own schedule — Day Close
    // doesn't duplicate it. denis_timeline: explicit keep (no policy yet).
    // Anything else falling through has no wired handler — recorded as
    // skipped rather than silently ignored.
    summary.skipped.push(`${entry.table}:${entry.dayClose}`);
  }

  const { error: insertError } = await admin.from("denis_day_closes").insert({
    location_id: input.locationId,
    business_date: input.businessDate,
    summary,
  });

  if (insertError) {
    logger.warn("runDenisDayClose insert failed", {
      locationId: input.locationId,
      businessDate: input.businessDate,
      error: insertError.message,
    });
  }

  logger.info("Denis day close completed", {
    locationId: input.locationId,
    businessDate: input.businessDate,
    summary,
  });

  return { alreadyClosed: false, summary };
}
