import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

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
    try {
      return await handler(req, ctx);
    } catch (error) {
      logger.error(`Unhandled: ${name}`, {
        method: req.method,
        url: req.nextUrl.pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return apiError("Internal server error.", 500);
    }
  };
}
