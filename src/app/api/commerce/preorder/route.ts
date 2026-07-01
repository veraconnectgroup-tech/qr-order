import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import {
  buildPreorderConfirmationMessage,
  estimatePreorderPrepMinutes,
} from "@/lib/denis/commerce/preorder-flow";
import { persistScheduledPreorder } from "@/lib/denis/commerce/persist-preorder";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const itemSchema = z.object({
  productId: zUuid(),
  productName: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(99),
  menuSection: z.string().nullable().optional(),
  notes: z.string().max(500).optional().default(""),
});

const bodySchema = z.object({
  locationId: zUuid(),
  tableId: zUuid().nullable().optional(),
  guestId: z.string().min(8).max(128),
  items: z.array(itemSchema).min(1).max(50),
  scheduledFor: z.string().datetime(),
  note: z.string().max(500).nullable().optional(),
  paymentMethod: z.enum(["online", "on_arrival"]),
  idempotencyKey: z.string().min(8).max(120),
  prepTimeEstimateMinutes: z.number().int().min(0).max(180).optional(),
  language: z.string().max(10).optional(),
});

export const POST = withErrorHandler("commerce-preorder-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const cohortKey = parsed.data.guestId;
  if (
    !isCommerceCapabilityActive({
      capabilityId: "preorder.scheduled",
      cohortKey,
    })
  ) {
    return apiError("Preorder is not available at this venue.", 403);
  }

  const admin = createAdminClient();

  const { data: unavailableRows } = await admin
    .from("products")
    .select("id")
    .eq("location_id", parsed.data.locationId)
    .eq("is_available", false);

  const unavailableProductIds = (
    (unavailableRows ?? []) as Array<{ id: string }>
  ).map((row) => row.id);

  const result = await persistScheduledPreorder(admin, {
    request: {
      locationId: parsed.data.locationId,
      tableId: parsed.data.tableId ?? null,
      guestId: parsed.data.guestId,
      items: parsed.data.items,
      scheduledFor: parsed.data.scheduledFor,
      note: parsed.data.note ?? null,
      paymentMethod: parsed.data.paymentMethod,
    },
    unavailableProductIds,
    prepTimeEstimateMinutes: parsed.data.prepTimeEstimateMinutes,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!result.ok) {
    return apiError(result.errors.join(", "), 400);
  }

  const prepTime = estimatePreorderPrepMinutes(
    parsed.data.items,
    parsed.data.prepTimeEstimateMinutes ?? 0
  );

  return apiSuccess({
    preorderId: result.preorderId,
    kitchenReleaseAt: result.kitchenReleaseAt,
    noShowCancelAt: result.noShowCancelAt,
    message:
      result.confirmationMessage ??
      buildPreorderConfirmationMessage({
        items: parsed.data.items,
        scheduledFor: parsed.data.scheduledFor,
        prepTimeEstimateMinutes: prepTime,
        language: parsed.data.language,
      }),
  });
});
