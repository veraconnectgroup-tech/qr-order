import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import {
  healthHttpStatus,
  runHealthChecks,
} from "@/lib/health/checks";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401, undefined, noCache());
  }

  const payload = await runHealthChecks({ includeWriteTest: true });

  return NextResponse.json(payload, {
    status: healthHttpStatus(payload.status),
    headers: noCache(),
  });
}
