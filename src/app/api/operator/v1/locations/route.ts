import { apiError } from "@/lib/api-response";
import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withOperatorReadRoute(
  "operator-v1-locations-get",
  async (_req, _ctx, auth) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("locations")
      .select("id, name, ai_concierge_enabled")
      .eq("org_id", auth.orgId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return apiError(error.message, 500);
    }

    const locations = ((data ?? []) as Array<{
      id: string;
      name: string;
      ai_concierge_enabled: boolean;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      denisEnabled: row.ai_concierge_enabled,
    }));

    return operatorJson({ locations });
  }
);
