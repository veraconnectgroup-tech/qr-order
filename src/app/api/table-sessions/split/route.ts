import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { withRateLimit } from "@/lib/rate-limit";
import { zOrderNotesOptional, zUuid } from "@/lib/security/zod-fields";
import { splitTableSession } from "@/lib/tables/merge-split-table-sessions";

const splitSchema = z.object({
  table_id: zUuid(),
  order_ids: z.array(zUuid()).min(1),
  target_table_id: zUuid().optional(),
  note: zOrderNotesOptional(),
});

export const POST = withErrorHandler(
  "table-sessions-split-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) return apiError("Unauthorized.", 401);

    if (!["owner", "manager", "staff", "waiter"].includes(staff.role)) {
      return apiError("Unauthorized.", 403);
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) return apiError("No location assigned.", 400);

    const parsed = splitSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const result = await splitTableSession({
      tableId: parsed.data.table_id,
      orderIds: parsed.data.order_ids,
      targetTableId: parsed.data.target_table_id,
      staffId: staff.id,
      locationId,
      note: parsed.data.note,
    });

    if ("error" in result) {
      return apiError(result.error, result.status ?? 500);
    }

    return NextResponse.json({
      ok: true,
      transferred: result.data.transferred,
      from_session_id: result.data.fromSessionId,
      to_session_id: result.data.toSessionId,
      to_table_name: result.data.toTableName,
    });
  }
);
