import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";
import { isUuid } from "@/lib/security/sanitize";
import { zSessionToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/rate-limit";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name)";

async function verifyGuestOrderAccess(orderId: string, sessionToken: string) {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, session_id")
    .eq("id", orderId)
    .single();

  if (!order) return false;

  const row = order as { id: string; session_id: string | null };
  if (!row.session_id) return false;

  const { data: session } = await admin
    .from("table_sessions")
    .select("session_token")
    .eq("id", row.session_id)
    .single();

  return (
    !!session &&
    (session as { session_token: string }).session_token === sessionToken
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const limited = await withRateLimit(req, "orders");
  if (limited) return limited;

  const { orderId } = await params;

  if (!isUuid(orderId)) {
    return apiError("Invalid order id.", 400);
  }

  const sessionParsed = zSessionToken().safeParse(
    req.nextUrl.searchParams.get("sessionToken") ?? ""
  );
  if (!sessionParsed.success) {
    return apiError("Unauthorized", 401);
  }
  const sessionToken = sessionParsed.data;

  const allowed = await verifyGuestOrderAccess(orderId, sessionToken);
  if (!allowed) {
    return apiError("Unauthorized", 401);
  }

  const encoder = new TextEncoder();
  const admin = createAdminClient();

  const stream = new ReadableStream({
    async start(controller) {
      let lastPayload = "";
      let closed = false;

      const sendOrder = async () => {
        if (closed) return;
        const { data } = await admin
          .from("orders")
          .select(ORDER_SELECT)
          .eq("id", orderId)
          .single();

        if (!data) return;
        const json = JSON.stringify(data);
        if (json !== lastPayload) {
          lastPayload = json;
          controller.enqueue(encoder.encode(`data: ${json}\n\n`));
        }
      };

      await sendOrder();

      const channel = admin
        .channel(`order-stream:${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          () => {
            sendOrder().catch(() => {});
          }
        )
        .subscribe();

      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        admin.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
