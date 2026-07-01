import { NextRequest, NextResponse } from "next/server";
import {
  getClientIp,
  withRateLimit,
  withRateLimitByKey,
  type RateLimitScope,
} from "@/lib/rate-limit";

type RouteContext = { params: Promise<Record<string, string>> };

export type RouteHandler = (
  req: NextRequest,
  ctx: RouteContext
) => Promise<Response>;

export type ApiGuardOptions = {
  keyExtractor?: (req: NextRequest, ctx: RouteContext) => string | Promise<string>;
};

/**
 * Standard rate-limit wrapper for API routes.
 * Uses IP by default; pass keyExtractor for session/token-scoped limits.
 */
export function withApiGuard(
  scope: RateLimitScope,
  handler: RouteHandler,
  options?: ApiGuardOptions
): RouteHandler {
  return async (req, ctx) => {
    const key =
      (await options?.keyExtractor?.(req, ctx)) ?? getClientIp(req);
    const rateLimitResult = await withRateLimitByKey(scope, key);
    if (rateLimitResult) return rateLimitResult;
    return handler(req, ctx);
  };
}

/** Rate limit cron routes before secret verification (brute-force protection). */
export async function withCronRateLimit(
  req: NextRequest
): Promise<NextResponse | null> {
  return withRateLimit(req, "jobs");
}
