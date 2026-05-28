import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError } from "@/lib/api-response";
import { readViewVersionBump } from "@/lib/denis/actor/view-version";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withGuestRateLimits } from "@/lib/rate-limit";
import { resolveOrgIdFromTableToken } from "@/lib/rate-limit/org-context";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const STREAM_INTERVAL_MS = 1_500;
const MAX_STREAM_MS = 55_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ADR-019 Phase E — SSE view.version stream (replaces poll when connected). */
export const GET = withErrorHandler("denis-view-stream-get", async (req, _ctx) => {
  const tableToken = req.nextUrl.searchParams.get("tableToken");
  const sessionToken = req.nextUrl.searchParams.get("sessionToken");

  if (!sessionToken) {
    return apiError("Unauthorized.", 401);
  }
  if (!tableToken) {
    return apiError("Invalid table.", 400);
  }

  const sessionParsed = zSessionToken().safeParse(sessionToken);
  if (!sessionParsed.success) {
    return apiError("Unauthorized.", 401);
  }

  const tableParsed = zTableToken().safeParse(tableToken);
  if (!tableParsed.success) {
    return apiError("Invalid table.", 400);
  }

  const orgId = await resolveOrgIdFromTableToken(tableParsed.data);
  const limited = await withGuestRateLimits(req, "sessions", orgId);
  if (limited) return limited;

  const admin = createAdminClient();
  const sessionResult = await validateTableSession(
    admin,
    tableParsed.data,
    sessionParsed.data
  );

  if ("error" in sessionResult) {
    return apiError(sessionResult.error, sessionResult.status);
  }

  const sessionId = sessionResult.data.session.id;

  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let lastVersion: number | null = null;

      const sendVersion = (version: number) => {
        if (lastVersion != null && version <= lastVersion) return;
        lastVersion = version;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ version, sessionId })}\n\n`)
        );
      };

      try {
        while (Date.now() - started < MAX_STREAM_MS) {
          const bumped = await readViewVersionBump(sessionId);
          if (bumped != null) {
            sendVersion(bumped);
          } else {
            const { data } = await admin
              .from("guest_scene" as never)
              .select("version")
              .eq("session_id", sessionId)
              .maybeSingle();
            const row = data as { version?: number } | null;
            if (row?.version != null) {
              sendVersion(row.version);
            }
          }

          await sleep(STREAM_INTERVAL_MS);
        }
      } catch {
        // Client disconnected or stream aborted.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
