import { operatorJson, withOperatorReadRoute } from "@/lib/operator/route-handler";
import { projectOperatorSessionList } from "@/lib/operator/projections/list-sessions";
import { createAdminClient } from "@/lib/supabase/admin";

function parseConverted(value: string | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export const GET = withOperatorReadRoute(
  "operator-v1-sessions-get",
  async (req, _ctx, auth) => {
    const params = req.nextUrl.searchParams;
    const admin = createAdminClient();

    const sessions = await projectOperatorSessionList(admin, {
      orgId: auth.orgId,
      locationId: params.get("locationId"),
      from: params.get("from"),
      to: params.get("to"),
      converted: parseConverted(params.get("converted")),
    });

    return operatorJson({ sessions });
  }
);
