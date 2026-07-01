import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  tableId: z.string().uuid().optional(),
  message: z.string().min(3).max(240).optional(),
});

export const POST = withErrorHandler(
  "waiter-assistance-request-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400, undefined, noCache());
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiError("Invalid request.", 400, parsed.error.flatten(), noCache());
    }

    let tableName: string | undefined;
    if (parsed.data.tableId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("tables")
        .select("name")
        .eq("id", parsed.data.tableId)
        .eq("location_id", locationId)
        .maybeSingle();
      tableName = (data as { name?: string } | null)?.name;
    }

    const message =
      parsed.data.message?.trim() ||
      (tableName
        ? `${staff.name} traži pomoć na stolu ${tableName}`
        : `${staff.name} traži pomoć menadžera`);

    await dispatchStaffNotification({
      orgId: staff.org_id,
      locationId,
      type: "denis_escalation",
      message,
      tableId: parsed.data.tableId,
      tableName,
      actionUrl: parsed.data.tableId
        ? `/waiter/tables/${parsed.data.tableId}`
        : "/dashboard",
      priorityOverride: "high",
      playSound: true,
    });

    return apiSuccess({ ok: true }, 200, noCache());
  }
);
