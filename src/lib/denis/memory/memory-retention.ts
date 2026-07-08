/**
 * ADR-045 S3 — executable retention sweep driven by memory-registry.ts.
 * Audit-tier tables are hard-exempt (GoBD) — never deleted here even if
 * the registry accidentally declares a retention window.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { retentionCutoffIso } from "@/lib/data-retention";
import {
  entriesWithExpiredRetention,
  type MemoryRegistryEntry,
} from "@/lib/denis/memory/memory-registry";
import {
  expireStationQuestionTurns,
} from "@/lib/denis/stations/station-questions";
import { logger } from "@/lib/logger";

/** Hard belt — audit tables must never be swept by this job. */
export const AUDIT_TABLES_HARD_EXEMPT = [
  "order_events",
  "denis_day_closes",
  "denis_audit_entries",
  "commerce_experience_events",
  "ai_order_events",
] as const;

function isAuditTableHardExempt(table: string): boolean {
  return (AUDIT_TABLES_HARD_EXEMPT as readonly string[]).includes(table);
}

export const MEMORY_RETENTION_BATCH_LIMIT = 500;

export type MemoryRetentionTableResult = {
  table: string;
  deleted: number;
  action: "delete" | "skip";
};

export type MemoryRetentionSummary = {
  processed: MemoryRetentionTableResult[];
  skipped: string[];
};

async function deleteExpiredRows(
  admin: SupabaseClient,
  input: {
    table: string;
    dateColumn: string;
    cutoffIso: string;
    statusIn?: string[];
  }
): Promise<number> {
  let query = admin.from(input.table as never).delete();

  if (input.statusIn) {
    query = query.in("status", input.statusIn);
  }

  const { data, error } = await query
    .lt(input.dateColumn, input.cutoffIso)
    .limit(MEMORY_RETENTION_BATCH_LIMIT)
    .select("id");

  if (error) {
    logger.warn("memory retention delete failed", {
      table: input.table,
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).length;
}

async function sweepRegistryEntry(
  admin: SupabaseClient,
  entry: MemoryRegistryEntry,
  now: Date
): Promise<MemoryRetentionTableResult> {
  if (entry.tier === "audit" || isAuditTableHardExempt(entry.table)) {
    return { table: entry.table, deleted: 0, action: "skip" };
  }

  if (entry.retentionDays == null) {
    return { table: entry.table, deleted: 0, action: "skip" };
  }

  const cutoffIso = retentionCutoffIso(entry.retentionDays, now);

  switch (entry.table) {
    case "denis_turn_traces":
      // Owned by src/app/api/cron/cleanup/route.ts — avoid double sweep.
      return { table: entry.table, deleted: 0, action: "skip" };

    case "station_question_turns": {
      const { data: locations } = await admin
        .from("locations")
        .select("id")
        .limit(MEMORY_RETENTION_BATCH_LIMIT);
      let deleted = 0;
      for (const row of (locations ?? []) as Array<{ id: string }>) {
        deleted += await expireStationQuestionTurns(admin, {
          locationId: row.id,
          retentionDays: entry.retentionDays,
        });
      }
      return { table: entry.table, deleted, action: "delete" };
    }

    case "station_questions":
      return {
        table: entry.table,
        deleted: await deleteExpiredRows(admin, {
          table: entry.table,
          dateColumn: "asked_at",
          cutoffIso,
          statusIn: ["expired", "answered", "cancelled"],
        }),
        action: "delete",
      };

    case "table_bus_obligations":
      return {
        table: entry.table,
        deleted: await deleteExpiredRows(admin, {
          table: entry.table,
          dateColumn: "created_at",
          cutoffIso,
          statusIn: ["bussed", "cancelled"],
        }),
        action: "delete",
      };

    case "denis_staff_table_hints":
      return {
        table: entry.table,
        deleted: await deleteExpiredRows(admin, {
          table: entry.table,
          dateColumn: "expires_at",
          cutoffIso,
        }),
        action: "delete",
      };

    case "waiter_calls":
      return {
        table: entry.table,
        deleted: await deleteExpiredRows(admin, {
          table: entry.table,
          dateColumn: "created_at",
          cutoffIso,
          statusIn: ["resolved"],
        }),
        action: "delete",
      };

    case "denis_schedules":
      return {
        table: entry.table,
        deleted: await deleteExpiredRows(admin, {
          table: entry.table,
          dateColumn: "created_at",
          cutoffIso,
          statusIn: ["completed", "cancelled"],
        }),
        action: "delete",
      };

    case "denis_timeline":
      return {
        table: entry.table,
        deleted: await deleteExpiredRows(admin, {
          table: entry.table,
          dateColumn: "created_at",
          cutoffIso,
        }),
        action: "delete",
      };

    default:
      return { table: entry.table, deleted: 0, action: "skip" };
  }
}

async function sweepExpiredGuestMemory(
  admin: SupabaseClient,
  now: Date
): Promise<number> {
  const { data, error } = await admin
    .from("denis_guest_memory" as never)
    .delete()
    .lt("expires_at", now.toISOString())
    .limit(MEMORY_RETENTION_BATCH_LIMIT)
    .select("location_id");

  if (error) {
    logger.warn("sweepExpiredGuestMemory failed", { error: error.message });
    return 0;
  }

  return (data ?? []).length;
}

export async function runMemoryRetentionSweep(
  admin: SupabaseClient,
  now = new Date()
): Promise<MemoryRetentionSummary> {
  const summary: MemoryRetentionSummary = { processed: [], skipped: [] };

  for (const entry of entriesWithExpiredRetention()) {
    const result = await sweepRegistryEntry(admin, entry, now);
    if (result.action === "skip" && result.deleted === 0) {
      summary.skipped.push(entry.table);
    } else {
      summary.processed.push(result);
    }
  }

  const guestMemoryDeleted = await sweepExpiredGuestMemory(admin, now);
  if (guestMemoryDeleted > 0) {
    summary.processed.push({
      table: "denis_guest_memory",
      deleted: guestMemoryDeleted,
      action: "delete",
    });
  }

  logger.info("Memory retention sweep completed", {
    processed: summary.processed.map((row) => ({
      table: row.table,
      deleted: row.deleted,
    })),
    skipped: summary.skipped,
  });

  return summary;
}
