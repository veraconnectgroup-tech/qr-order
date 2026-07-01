import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseReorderOrderRow } from "@/lib/supabase/parse-order-rows";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  sessionToken: z.string().min(1),
  tableToken: z.string().min(1),
});

export const POST = withErrorHandler(
  "orders-reorder-post",
  async (req, ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const { orderId } = await ctx.params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const admin = createAdminClient();
    const sessionResult = await validateTableSession(
      admin,
      parsed.data.tableToken,
      parsed.data.sessionToken
    );
    if ("error" in sessionResult) {
      return apiError(sessionResult.error, sessionResult.status);
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, session_id, order_items(id, product_id, product_name, quantity, unit_price, notes, tax_rate, menu_section, order_item_modifiers(modifier_id, modifier_name, price))"
      )
      .eq("id", orderId)
      .eq("session_id", sessionResult.data.session.id)
      .maybeSingle();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const items = parseReorderOrderRow(order).order_items;

    const productIds = [
      ...new Set(items.map((item) => item.product_id).filter(Boolean)),
    ] as string[];

    const { data: products } = productIds.length
      ? await admin
          .from("products")
          .select("id, is_available, price")
          .in("id", productIds)
      : { data: [] };

    const productMap = new Map(
      ((products ?? []) as Array<{
        id: string;
        is_available: boolean;
        price: number;
      }>).map((product) => [product.id, product])
    );

    const cartItems: Array<{
      productId: string;
      productName: string;
      unitPrice: number;
      quantity: number;
      notes: string;
      menuSection: "drinks" | "food" | "desserts";
      productTaxRate: number;
      modifiers: Array<{
        modifierId: string;
        modifierName: string;
        price: number;
      }>;
    }> = [];
    const skipped: string[] = [];

    for (const item of items) {
      if (!item.product_id) {
        skipped.push(item.product_name);
        continue;
      }

      const product = productMap.get(item.product_id);
      if (!product?.is_available) {
        skipped.push(item.product_name);
        continue;
      }

      cartItems.push({
        productId: item.product_id,
        productName: item.product_name,
        unitPrice: Number(product.price),
        quantity: item.quantity,
        notes: item.notes ?? "",
        menuSection: item.menu_section,
        productTaxRate: Number(item.tax_rate),
        modifiers: item.order_item_modifiers.map((modifier) => ({
          modifierId: modifier.modifier_id ?? modifier.modifier_name,
          modifierName: modifier.modifier_name,
          price: Number(modifier.price),
        })),
      });
    }

    return apiSuccess({ cartItems, skipped });
  }
);
