import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { createStationQuestion } from "@/lib/denis/stations/station-questions";
import {
  buildStationQuestionMessage,
  stationForOrder,
} from "@/lib/denis/stations/question-triggers";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  orderId: z.string().uuid(),
  station: z.enum(["kitchen", "bar"]).optional(),
});

/** Manager manually asks the station about an order ("Pitaj kuhinju"). */
export const POST = withErrorHandler(
  "station-questions-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten());
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
    const { data: order } = await admin
      .from("orders")
      .select(
        "id, location_id, table_id, order_number, created_at, status, order_items(menu_section)"
      )
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const orderRow = order as unknown as {
      id: string;
      location_id: string;
      table_id: string | null;
      order_number: number | null;
      created_at: string;
      status: string;
      order_items: Array<{ menu_section: string | null }>;
    };

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", orderRow.location_id)
      .maybeSingle();

    if (
      !location ||
      (location as { org_id: string }).org_id !== staffRow.org_id ||
      (staffRow.location_id && staffRow.location_id !== orderRow.location_id)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const config = await loadConciergeConfigForLocation(orderRow.location_id);
    if (!config.ops.stationQuestions.enabled) {
      return apiError("Station questions are not enabled.", 409);
    }

    const station =
      parsed.data.station ??
      stationForOrder({
        hasKitchenItems: orderRow.order_items.some((item) =>
          isKitchenMenuSection(item.menu_section)
        ),
        hasDrinkItems: orderRow.order_items.some(
          (item) => item.menu_section === "drinks"
        ),
      });

    let tableName: string | null = null;
    if (orderRow.table_id) {
      const { data: table } = await admin
        .from("tables")
        .select("name")
        .eq("id", orderRow.table_id)
        .maybeSingle();
      tableName = (table as { name: string } | null)?.name ?? null;
    }

    const waitMinutes = Math.max(
      0,
      Math.floor((Date.now() - Date.parse(orderRow.created_at)) / 60_000)
    );

    const result = await createStationQuestion(admin, {
      locationId: orderRow.location_id,
      orderId: orderRow.id,
      tableId: orderRow.table_id,
      station,
      questionType: "eta",
      message: buildStationQuestionMessage({
        questionType: "eta",
        station,
        tableName: tableName ?? "—",
        orderNumber: orderRow.order_number,
        waitMinutes,
      }),
      askedBy: "manager",
      sourceEvent: "manager",
      config: config.ops.stationQuestions,
    });

    if (!result.created) {
      if (result.reason === "already_open") {
        return apiError("Pitanje je već poslato — čeka odgovor.", 409);
      }
      if (result.reason === "order_closed") {
        return apiError("Porudžbina je već zatvorena ili spremna.", 409);
      }
      return apiError("Pitanje nije moglo da se pošalje.", 500);
    }

    return apiSuccess({ question: result.question });
  }
);
