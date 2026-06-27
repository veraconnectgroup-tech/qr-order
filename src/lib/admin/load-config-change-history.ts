import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parsePartialConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";

export type ConfigChangeLogEntry = {
  id: string;
  locationId: string | null;
  changedBy: string;
  configPath: string | null;
  oldValue: PartialConciergeConfig | null;
  newValue: PartialConciergeConfig | null;
  reason: string | null;
  proposalId: string | null;
  createdAt: string;
};

export async function loadConfigChangeHistory(
  admin: SupabaseClient,
  input: { orgId: string; locationId: string; limit?: number }
): Promise<ConfigChangeLogEntry[]> {
  const { data, error } = await admin
    .from("config_change_log")
    .select(
      "id, location_id, changed_by, config_path, old_value, new_value, reason, proposal_id, created_at"
    )
    .eq("org_id", input.orgId)
    .eq("location_id", input.locationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const typed = row as {
      id: string;
      location_id: string | null;
      changed_by: string;
      config_path: string | null;
      old_value: unknown;
      new_value: unknown;
      reason: string | null;
      proposal_id: string | null;
      created_at: string;
    };

    return {
      id: typed.id,
      locationId: typed.location_id,
      changedBy: typed.changed_by,
      configPath: typed.config_path,
      oldValue: parsePartialConciergeConfig(typed.old_value),
      newValue: parsePartialConciergeConfig(typed.new_value),
      reason: typed.reason,
      proposalId: typed.proposal_id,
      createdAt: typed.created_at,
    };
  });
}
