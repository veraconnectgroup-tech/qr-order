import type { RecoveryAction } from "@/lib/denis/cognition/recovery/frustration-recovery";
import { resolveFrustrationStaffEscalation } from "@/lib/denis/cognition/recovery/frustration-recovery";
import type { StaffProactiveAlert } from "@/lib/denis/cognition/proactive/proactive-types";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { emitStaffProactiveAlert } from "@/lib/denis/runtime/emit-staff-proactive-alert";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const FRUSTRATION_HINT = "Gost frustriran";

function staffAlertMessage(tableName: string): string {
  return `Pređi na sto ${tableName}`;
}

async function upsertFrustrationStaffHint(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
  }
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

  await admin
    .from("denis_staff_table_hints" as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("location_id", input.locationId)
    .eq("table_id", input.tableId)
    .is("revoked_at", null);

  const { error } = await admin.from("denis_staff_table_hints" as never).insert({
    location_id: input.locationId,
    table_id: input.tableId,
    text: FRUSTRATION_HINT,
    visibility: "denis_only",
    expires_at: expiresAt,
    created_by_staff_id: null,
  } as never);

  if (error) {
    logger.warn("Frustration staff hint upsert failed", {
      locationId: input.locationId,
      tableId: input.tableId,
      error: error.message,
    });
  }
}

/** Side effects for staff_escalation recovery — timeline alert + copilot hint (I1). */
export async function applyFrustrationRecoveryEscalation(
  admin: SupabaseClient,
  input: {
    actions: RecoveryAction[];
    config: ConciergeConfig;
    locationId: string;
    tableId: string;
    tableName: string;
    aiSessionId: string;
    sessionToken: string | null;
    traceId: string;
  }
): Promise<{ waiterHandoff: boolean }> {
  const escalation = resolveFrustrationStaffEscalation(input.actions);
  if (!escalation) {
    return { waiterHandoff: false };
  }

  const alert: StaffProactiveAlert = {
    kind: "staff_frustrated_guest",
    tableName: input.tableName,
    message: staffAlertMessage(input.tableName),
    detail: escalation.reason,
  };

  await Promise.all([
    emitStaffProactiveAlert(admin, {
      locationId: input.locationId,
      aiSessionId: input.aiSessionId,
      tableId: input.tableId,
      alert,
      traceId: input.traceId,
    }),
    upsertFrustrationStaffHint(admin, {
      locationId: input.locationId,
      tableId: input.tableId,
    }),
  ]);

  let waiterHandoff = false;
  if (
    escalation.urgency === "urgent" &&
    input.config.handoff.waiterCall &&
    input.config.handoff.liveExecution &&
    input.sessionToken
  ) {
    const result = await executeDenisWaiterHandoff(admin, {
      tableId: input.tableId,
      locationId: input.locationId,
      tableToken: input.sessionToken,
      sessionToken: input.sessionToken,
    });
    waiterHandoff = result.ok;
  }

  return { waiterHandoff };
}
