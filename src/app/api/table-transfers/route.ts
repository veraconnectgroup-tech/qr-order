import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { zOrderNotesOptional, zUuid } from "@/lib/security/zod-fields";
import { transferOrders } from "@/lib/tables/transfer-orders";

const transferSchema = z.object({
  from_table_id: zUuid(),
  to_table_id: zUuid(),
  order_ids: z.array(zUuid()).optional().default([]),
  note: zOrderNotesOptional(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    if (!["owner", "manager", "staff"].includes(staff.role)) {
      return apiError("Unauthorized.", 403);
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400);
    }

    const body = await req.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    const result = await transferOrders({
      fromTableId: parsed.data.from_table_id,
      toTableId: parsed.data.to_table_id,
      orderIds: parsed.data.order_ids ?? [],
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
    });
  } catch (error) {
    logger.error("Table transfer error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Transfer could not be completed.", 500);
  }
}
