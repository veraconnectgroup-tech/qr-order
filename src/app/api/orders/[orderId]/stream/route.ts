import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { noCache } from "@/lib/cache/headers";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/security/sanitize";
import { zSessionToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/rate-limit";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name)";

// Polling, not a Supabase Realtime channel: this route runs inside a
// serverless function with no maxDuration guarantee that the platform
// won't kill the invocation before a channel's cleanup code can run. A
// channel opened per-request here orphaned a Realtime connection at
// Supabase every time that happened, across every guest's whole order-
// tracking session — the actual cause of the org's Realtime Connection
// Count quota being blown ~19x over on 2026-07-17. Same safe pattern as
// the sibling `denis/view/stream` route, which never had this problem.
const POLL_INTERVAL_MS = 2_000;
const MAX_STREAM_DURATION_MS = 55_000;

export const maxDuration = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export const GET = withErrorHandler(
  "orders-orderId-stream-get",
  async (req, ctx) => {
    const cacheHeaders = noCache();
    const limited = await withRateLimit(req, "orders-guest");
    if (limited) return limited;

    const { orderId } = await ctx.params;

    if (!isUuid(orderId)) {
      return apiError("Invalid order id.", 400, undefined, cacheHeaders);
    }

    const sessionParsed = zSessionToken().safeParse(
      req.nextUrl.searchParams.get("sessionToken") ?? ""
    );
    if (!sessionParsed.success) {
      return apiError("Unauthorized", 401, undefined, cacheHeaders);
    }
    const sessionToken = sessionParsed.data;

    const allowed = await verifyGuestOrderAccess(orderId, sessionToken);
    if (!allowed) {
      return apiError("Unauthorized", 401, undefined, cacheHeaders);
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("location_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Not found", 404, undefined, cacheHeaders);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let lastPayload = "";
        let closed = false;

        function safeSend(data: Uint8Array) {
          if (closed) return;
          try {
            controller.enqueue(data);
          } catch {
            closeStream();
          }
        }

        function closeStream() {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          clearTimeout(maxDurationTimer);
          try {
            controller.close();
          } catch {
            // Stream already closed.
          }
        }

        const sendOrder = async () => {
          if (closed) return;
          try {
            const { data } = await admin
              .from("orders")
              .select(ORDER_SELECT)
              .eq("id", orderId)
              .single();

            if (!data) return;
            const json = JSON.stringify(data);
            if (json !== lastPayload) {
              lastPayload = json;
              safeSend(encoder.encode(`data: ${json}\n\n`));
            }
          } catch (error) {
            logger.warn("Order stream sendOrder failed", {
              orderId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        };

        await sendOrder();

        const heartbeat = setInterval(() => {
          safeSend(encoder.encode(": ping\n\n"));
        }, 15000);

        const maxDurationTimer = setTimeout(closeStream, MAX_STREAM_DURATION_MS);

        req.signal.addEventListener("abort", closeStream);

        (async () => {
          while (!closed) {
            await sleep(POLL_INTERVAL_MS);
            await sendOrder();
          }
        })().catch((error) => {
          logger.warn("Order stream poll loop failed", {
            orderId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "private, no-cache, no-store, no-transform",
        Connection: "keep-alive",
      },
    });
  }
);
