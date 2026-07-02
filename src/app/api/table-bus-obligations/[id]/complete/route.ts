import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { completeBusTableObligation } from "@/lib/denis/cognition/waiter/bus-table-obligation";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/** Waiter one-tap: mark table bussed (ADR-043 S13). */
export const POST = withErrorHandler(
  "table-bus-obligations-complete-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { id } = await ctx.params;
    if (!isUuid(id)) {
      return apiError("Invalid obligation id.", 400);
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiError("Unauthorized.", 401);
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("id, org_id, location_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const staffRow = staff as {
      id: string;
      org_id: string;
      location_id: string | null;
    };

    const admin = createAdminClient();
    const { data: obligation } = await admin
      .from("table_bus_obligations")
      .select("id, location_id")
      .eq("id", id)
      .maybeSingle();

    if (!obligation) {
      return apiError("Obligation not found.", 404);
    }

    const obligationRow = obligation as { id: string; location_id: string };

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", obligationRow.location_id)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id &&
        staffRow.location_id !== obligationRow.location_id)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const result = await completeBusTableObligation(admin, {
      obligationId: obligationRow.id,
      staffId: staffRow.id,
    });

    if (!result.ok) {
      if (result.error === "not_open") {
        return apiError("Sto je već označen kao raspremljen.", 409);
      }
      return apiError("Nije moguće sačuvati.", 500);
    }

    return apiSuccess({ obligation: result.obligation });
  }
);
