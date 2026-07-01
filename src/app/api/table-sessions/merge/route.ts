import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { withRateLimit } from "@/lib/rate-limit";
import { zOrderNotesOptional, zUuid } from "@/lib/security/zod-fields";
import { mergeTableSessions } from "@/lib/tables/merge-split-table-sessions";

const mergeSchema = z.object({
  primary_table_id: zUuid(),
  secondary_table_id: zUuid(),
  note: zOrderNotesOptional(),
});

export const POST = withErrorHandler(
  "table-sessions-merge-post",
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

    const parsed = mergeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const result = await mergeTableSessions({
      primaryTableId: parsed.data.primary_table_id,
      secondaryTableId: parsed.data.secondary_table_id,
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
      to_table_name: result.data.toTableName,
      to_session_id: result.data.toSessionId,
    });
  }
);
