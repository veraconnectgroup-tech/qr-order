import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withRateLimit } from "@/lib/rate-limit";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "tables-token-orders-get",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "sessions");
    if (limited) return limited;

    const sessionToken = req.nextUrl.searchParams.get("sessionToken");
    const sessionParsed = zSessionToken().safeParse(sessionToken ?? "");
    if (!sessionParsed.success) {
      return apiError("Unauthorized.", 401);
    }

    const { token } = await ctx.params;
    const tableParsed = zTableToken().safeParse(token);
    if (!tableParsed.success) {
      return apiError("Invalid table.", 400);
    }

    const admin = createAdminClient();
    const sessionResult = await validateTableSession(
      admin,
      tableParsed.data,
      sessionParsed.data
    );

    if ("error" in sessionResult) {
      return apiError(sessionResult.error, sessionResult.status);
    }

    const { session } = sessionResult.data;

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        `
      id,
      order_number,
      status,
      created_at,
      delivered_at,
      order_items (
        product_id,
        product_name,
        unit_price,
        quantity,
        menu_section
      )
    `
      )
      .eq("session_id", session.id)
      .not("status", "in", '("rejected","cancelled")')
      .order("created_at", { ascending: true });

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess({ orders: orders ?? [] });
  }
);
