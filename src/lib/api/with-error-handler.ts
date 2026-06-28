import type { NextRequest } from "next/server";
import { apiError, apiErrorResponse, ERROR_CODES } from "@/lib/api-response";
import { ApiUnauthorizedError } from "@/lib/auth/require-staff-permission";
import { PermissionDeniedError } from "@/lib/auth/staff-access";
import { logger } from "@/lib/logger";
import {
  applyTraceToSentry,
  getTraceId,
} from "@/lib/resilience/trace";
import { runWithTraceIdAsync } from "@/lib/resilience/trace.server";

type RouteContext = { params: Promise<Record<string, string>> };

export type RouteHandler = (
  req: NextRequest,
  ctx: RouteContext
) => Promise<Response>;

export function withErrorHandler(
  name: string,
  handler: RouteHandler
): RouteHandler {
  return async (req, ctx) => {
    const traceId = getTraceId(req);
    applyTraceToSentry(traceId);

    return runWithTraceIdAsync(traceId, async () => {
      try {
        return await handler(req, ctx);
      } catch (error) {
        if (error instanceof ApiUnauthorizedError) {
          return apiError(error.message, error.statusCode);
        }
        if (error instanceof PermissionDeniedError) {
          return apiError("Forbidden.", error.statusCode);
        }
        logger.error(`Unhandled: ${name}`, {
          method: req.method,
          url: req.nextUrl.pathname,
          error: error instanceof Error ? error.message : String(error),
        });
        return apiErrorResponse(
          ERROR_CODES.INTERNAL,
          "Internal server error.",
          500,
          { traceId, retryable: true }
        );
      }
    });
  };
}
