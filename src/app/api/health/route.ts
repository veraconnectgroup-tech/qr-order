import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { cacheStaleWhileRevalidate, noCache } from "@/lib/cache/headers";
import {
  healthHttpStatus,
  runHealthChecks,
} from "@/lib/health/checks";
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withErrorHandler("health-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const payload = await runHealthChecks();
  const headers =
    payload.status === "healthy"
      ? cacheStaleWhileRevalidate(10, 30)
      : noCache();

  return NextResponse.json(payload, {
    status: healthHttpStatus(payload.status),
    headers,
  });
});
