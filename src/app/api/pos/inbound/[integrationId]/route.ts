import { NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { handlePosInboundWebhook } from "@/lib/pos/inbound/handle-inbound-webhook";
import { handleDeliverectWebhook } from "@/lib/pos/deliverect-webhook";
import { isUuid } from "@/lib/security/sanitize";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

function isDeliverectStatusEcho(body: Record<string, unknown>) {
  const status = body.status;
  const channelOrderId =
    typeof body.channelOrderId === "string" ? body.channelOrderId.trim() : "";
  const hasStatus =
    (typeof status === "number" && Number.isFinite(status)) ||
    (typeof status === "string" && status.trim() !== "");
  return hasStatus && channelOrderId !== "" && isUuid(channelOrderId) && !body.items;
}

export const POST = withErrorHandler(
  "pos-inbound-post",
  async (req, ctx) => {
    const { integrationId } = await ctx.params;

    if (!integrationId || !isUuid(integrationId)) {
      return new Response("Invalid integration id", { status: 400 });
    }

    const limited = await withRateLimitByKey("pos-inbound", integrationId);
    if (limited) return limited;

    const rawBody = await req.text();
    let parsed: Record<string, unknown> | null = null;

    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (parsed && isDeliverectStatusEcho(parsed)) {
      const legacy = await handleDeliverectWebhook(parsed);
      if (!legacy.ok) {
        return new Response(legacy.message, { status: 400 });
      }
      return new Response("OK", { status: 200 });
    }

    const result = await handlePosInboundWebhook(
      integrationId,
      rawBody,
      req.headers
    );

    if (!result.ok) {
      logger.warn("POS inbound webhook rejected", {
        integrationId,
        status: result.status,
        message: result.message,
      });
      return new Response(result.message, { status: result.status });
    }

    return Response.json(result.body, { status: result.status });
  }
);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await ctx.params;
  return Response.json({
    ok: true,
    integrationId,
    endpoint: "pos-inbound",
  });
}
