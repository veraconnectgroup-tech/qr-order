import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  buildRecordTipSelectionPayload,
  recordTipSelectionIdempotencyKey,
  resolveTipSplitModeFromParams,
  resolveTipStaffId,
} from "@/lib/commerce/capabilities/tips/record-tip-selection";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import { runCommerceExperience } from "@/lib/commerce/runtime/run-commerce-experience";
import { clampTipAmount } from "@/lib/orders/tips";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { getCurrentTraceId } from "@/lib/resilience/trace.server";
import { withRateLimit } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  orderId: zUuid(),
  sessionToken: zSessionToken(),
  tipAmount: z.number().min(0).max(500),
  tipPercent: z.number().min(0).max(100).nullable().optional(),
  presetIndex: z.number().int().min(0).max(5).nullable().optional(),
  smartDefaultUsed: z.boolean().optional().default(false),
  denisPromptShown: z.boolean().optional().default(false),
  experienceScore: z.number().min(0).max(10).nullable().optional(),
  marketRegion: z.enum(["de", "us", "balkan"]).optional(),
});

export const POST = withErrorHandler("commerce-tip-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const allowed = await verifyOrderSessionAccess(
    admin,
    parsed.data.orderId,
    parsed.data.sessionToken
  );
  if (!allowed) {
    return apiError("Unauthorized.", 401);
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, session_id, location_id, total, tip_amount, payment_status, table_id")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!order) {
    return apiError("Order not found.", 404);
  }

  const orderRow = order as {
    id: string;
    session_id: string | null;
    location_id: string;
    total: number;
    tip_amount: number | null;
    payment_status: string;
    table_id: string;
  };

  if (!orderRow.session_id) {
    return apiError("Invalid session.", 400);
  }

  if ((orderRow.tip_amount ?? 0) > 0) {
    return apiError("Tip already recorded.", 409);
  }

  const tipAmount = clampTipAmount(parsed.data.tipAmount, Number(orderRow.total));

  const { data: table } = await admin
    .from("tables")
    .select("assigned_staff_id")
    .eq("id", orderRow.table_id)
    .maybeSingle();

  const tipConfig =
    DEFAULT_COMMERCE_POLICY.capabilities["tips.smart_defaults"].params;
  const tipSplitMode = resolveTipSplitModeFromParams(tipConfig);
  const tipStaffId = resolveTipStaffId({
    splitMode: tipSplitMode,
    assignedStaffId:
      (table as { assigned_staff_id: string | null } | null)?.assigned_staff_id ??
      null,
  });

  const { error: updateError } = await admin
    .from("orders")
    .update({
      tip_amount: tipAmount,
      tip_staff_id: tipStaffId,
    })
    .eq("id", orderRow.id);

  if (updateError) {
    return apiError(updateError.message, 500);
  }

  const payload = buildRecordTipSelectionPayload({
    orderId: orderRow.id,
    tipAmount,
    tipPercent: parsed.data.tipPercent ?? null,
    smartDefaultUsed: parsed.data.smartDefaultUsed,
    presetIndex: parsed.data.presetIndex ?? null,
    tipSplitMode,
    denisPromptShown: parsed.data.denisPromptShown,
    experienceScore: parsed.data.experienceScore ?? null,
    marketRegion: parsed.data.marketRegion,
  });

  const commerce = await runCommerceExperience(admin, {
    kind: "guest_command",
    sessionId: orderRow.session_id,
    command: {
      type: "RecordTipSelection",
      payload,
    },
    idempotencyKey: recordTipSelectionIdempotencyKey(orderRow.id, tipAmount),
  }, {
    traceId: getCurrentTraceId(),
  });

  return apiSuccess({
    tipAmount,
    tipSplitMode,
    eventId: commerce.eventId,
  });
});
