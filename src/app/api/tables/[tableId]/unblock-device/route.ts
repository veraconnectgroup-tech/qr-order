import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { liftDeviceBlock } from "@/lib/sessions/order-blocks";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import type { Staff } from "@/types";

async function loadStaff(): Promise<Staff | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  return (staff as Staff | null) ?? null;
}

const bodySchema = z.object({
  deviceFingerprint: z.string().min(8).max(128),
});

export const POST = withErrorHandler(
  "tables-tableId-unblock-device-post",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await loadStaff();
    if (!staff || !["owner", "manager", "staff"].includes(staff.role)) {
      return apiError("Unauthorized.", 401);
    }

    const { tableId } = await ctx.params;
    if (!isUuid(tableId)) {
      return apiError("Invalid table id.", 400);
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const admin = createAdminClient();

    const { data: table } = await admin
      .from("tables")
      .select("id, location_id")
      .eq("id", tableId)
      .is("deleted_at", null)
      .single();

    if (!table) {
      return apiError("Table not found.", 404);
    }

    const tableRow = table as { id: string; location_id: string };

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", tableRow.location_id)
      .single();

    if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
      return apiError("Unauthorized.", 403);
    }

    const lifted = await liftDeviceBlock(admin, {
      tableId: tableRow.id,
      deviceFingerprint: parsed.data.deviceFingerprint,
      staffId: staff.id,
    });

    if (!lifted) {
      return apiError("No active block for this device.", 404);
    }

    await admin.from("audit_log").insert({
      action: "device.order_block_lifted",
      table_id: tableRow.id,
      staff_id: staff.id,
      reason: parsed.data.deviceFingerprint,
    });

    return apiSuccess({ ok: true });
  }
);
