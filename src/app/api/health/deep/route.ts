import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import {
  healthHttpStatus,
  runDeepHealthChecks,
} from "@/lib/health/checks";

async function authorizeDeepHealth(req: NextRequest): Promise<boolean> {
  const secret = process.env.HEALTH_CHECK_SECRET?.trim();
  if (secret) {
    const apiKey =
      req.headers.get("x-api-key")?.trim() ??
      req.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim();

    if (apiKey === secret) {
      return true;
    }
  }

  const staff = await getCurrentStaff();
  return staff?.is_platform_admin === true;
}

export const GET = withErrorHandler("health-deep-get", async (req, _ctx) => {
  if (!(await authorizeDeepHealth(req))) {
    return apiError("Unauthorized", 401, undefined, noCache());
  }

  const payload = await runDeepHealthChecks();

  return NextResponse.json(payload, {
    status: healthHttpStatus(payload.status),
    headers: noCache(),
  });
});
