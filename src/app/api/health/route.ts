import { NextResponse } from "next/server";
import { cacheStaleWhileRevalidate, noCache } from "@/lib/cache/headers";
import {
  healthHttpStatus,
  runHealthChecks,
} from "@/lib/health/checks";

export async function GET() {
  const payload = await runHealthChecks();
  const headers =
    payload.status === "healthy"
      ? cacheStaleWhileRevalidate(10, 30)
      : noCache();

  return NextResponse.json(payload, {
    status: healthHttpStatus(payload.status),
    headers,
  });
}
