import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Refresh org_ai_ops projection — all orgs or one org (ADR-009 F5/F7). */
export async function refreshOrgAiOpsProjection(
  admin: SupabaseClient,
  orgId?: string | null
): Promise<number> {
  const { data, error } = await admin.rpc("refresh_org_ai_ops", {
    p_org_id: orgId ?? null,
  });

  if (error) {
    logger.error("refresh_org_ai_ops failed", {
      orgId: orgId ?? "all",
      error: error.message,
    });
    throw new Error(error.message);
  }

  return (data as number) ?? 0;
}
