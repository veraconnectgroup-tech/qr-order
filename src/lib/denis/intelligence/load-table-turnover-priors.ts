import type { SupabaseClient } from "@supabase/supabase-js";
import { ewmaTurnoverMinutes } from "@/lib/denis/intelligence/table-turnover";
import type { GuestSessionDurationPrediction } from "@/lib/denis/cognition/mental-model/mental-model-types";

const HISTORY_LIMIT = 12;

export type GuestDurationPriorInput = {
  partySize: number;
  localHour: number;
  /** 0 = Sunday, 5 = Friday */
  dayOfWeek: number;
  tablePriorMinutes?: number | null;
};

/** Heuristic + table EWMA — solo lunch ~30min, date night ~90min (L2). */
export function predictGuestSessionDuration(
  input: GuestDurationPriorInput
): GuestSessionDurationPrediction {
  const partySize = Math.max(1, input.partySize);
  const isWeekday = input.dayOfWeek >= 1 && input.dayOfWeek <= 5;
  const isFriday = input.dayOfWeek === 5;
  const isLunch = input.localHour >= 11 && input.localHour <= 14;
  const isDateNight =
    isFriday && input.localHour >= 19 && input.localHour <= 22;

  let predictedMinutes = 60;
  let mode: GuestSessionDurationPrediction["mode"] = "normal";
  let confidence = 0.45;
  let priorSource: GuestSessionDurationPrediction["priorSource"] = "heuristic";

  if (partySize === 1 && isWeekday && isLunch) {
    predictedMinutes = 30;
    mode = "efficient";
    confidence = 0.78;
  } else if (partySize === 2 && isDateNight) {
    predictedMinutes = 90;
    mode = "relaxed";
    confidence = 0.8;
  } else if (partySize >= 4) {
    predictedMinutes = 85;
    mode = "relaxed";
    confidence = 0.65;
  } else if (partySize === 1) {
    predictedMinutes = 40;
    mode = "efficient";
    confidence = 0.55;
  }

  if (input.tablePriorMinutes != null && input.tablePriorMinutes > 0) {
    priorSource = "table_history";
    predictedMinutes = Math.round(
      predictedMinutes * 0.45 + input.tablePriorMinutes * 0.55
    );
    confidence = Math.min(0.92, confidence + 0.12);
    if (predictedMinutes <= 35) mode = "efficient";
    else if (predictedMinutes >= 75) mode = "relaxed";
  }

  return {
    predictedMinutes: Math.max(20, Math.min(150, predictedMinutes)),
    mode,
    confidence: Math.round(confidence * 100) / 100,
    priorSource,
  };
}

/** Load EWMA turnover minutes per table from completed sessions. */
export async function loadTableTurnoverPriors(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableIds: string[];
    venueFallbackMinutes?: number;
  }
): Promise<Map<string, number>> {
  const priors = new Map<string, number>();
  const fallback = input.venueFallbackMinutes ?? 75;

  if (input.tableIds.length === 0) return priors;

  const { data, error } = await admin
    .from("table_sessions")
    .select("table_id, opened_at, closed_at")
    .eq("location_id", input.locationId)
    .eq("status", "closed")
    .in("table_id", input.tableIds)
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(HISTORY_LIMIT * input.tableIds.length);

  if (error) {
    return priors;
  }

  const byTable = new Map<string, number[]>();
  for (const row of (data ?? []) as Array<{
    table_id: string;
    opened_at: string;
    closed_at: string;
  }>) {
    const durationMin = Math.round(
      (Date.parse(row.closed_at) - Date.parse(row.opened_at)) / 60_000
    );
    if (durationMin <= 0 || durationMin > 240) continue;
    const list = byTable.get(row.table_id) ?? [];
    if (list.length >= HISTORY_LIMIT) continue;
    list.push(durationMin);
    byTable.set(row.table_id, list);
  }

  for (const tableId of input.tableIds) {
    const samples = byTable.get(tableId) ?? [];
    priors.set(tableId, ewmaTurnoverMinutes(samples, fallback));
  }

  return priors;
}

export async function loadVenueTurnoverFallbackMinutes(
  admin: SupabaseClient,
  locationId: string
): Promise<number> {
  const { data } = await admin
    .from("table_sessions")
    .select("opened_at, closed_at")
    .eq("location_id", locationId)
    .eq("status", "closed")
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(40);

  const durations = ((data ?? []) as Array<{ opened_at: string; closed_at: string }>)
    .map((row) =>
      Math.round(
        (Date.parse(row.closed_at) - Date.parse(row.opened_at)) / 60_000
      )
    )
    .filter((minutes) => minutes > 0 && minutes <= 240);

  return ewmaTurnoverMinutes(durations, 75);
}
