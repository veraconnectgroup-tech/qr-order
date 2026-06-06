import type { NextRequest } from "next/server";
import { withErrorHandler, type RouteHandler } from "@/lib/api/with-error-handler";
import { apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import {
  authenticateOperatorApiKey,
  requireOperatorScope,
  type OperatorApiContext,
} from "@/lib/operator/auth";
import { logOperatorApiRequest } from "@/lib/operator/audit-log";
import { OPERATOR_API_VERSION } from "@/lib/operator/types";

const OPERATOR_HEADERS = {
  "X-Denis-Operator-Api-Version": OPERATOR_API_VERSION,
  "Cache-Control": "no-store",
};

type OperatorHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: OperatorApiContext
) => Promise<Response>;

export function withOperatorReadRoute(
  name: string,
  handler: OperatorHandler
): RouteHandler {
  return withErrorHandler(name, async (req, ctx) => {
    const startedAt = Date.now();
    const limited = await withRateLimit(req, "operator");
    if (limited) return limited;

    const auth = await authenticateOperatorApiKey(req);
    if (auth instanceof Response) {
      return auth;
    }

    const scopeErr = requireOperatorScope(auth, "operator:read");
    if (scopeErr) {
      void logOperatorApiRequest({
        ctx: auth,
        req,
        statusCode: 403,
        startedAt,
      });
      return scopeErr;
    }

    const response = await handler(req, ctx, auth);
    void logOperatorApiRequest({
      ctx: auth,
      req,
      statusCode: response.status,
      startedAt,
      includePii:
        req.nextUrl.searchParams.get("include") === "transcript" ||
        req.nextUrl.searchParams.get("include") === "pii",
    });

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(OPERATOR_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

export function operatorJson<T>(data: T, status = 200) {
  return apiSuccess(data, status, {
    ...noCache(),
    ...OPERATOR_HEADERS,
  });
}

type OperatorProposeHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: OperatorApiContext
) => Promise<Response>;

export function withOperatorProposeRoute(
  name: string,
  handler: OperatorProposeHandler
): RouteHandler {
  return withErrorHandler(name, async (req, ctx) => {
    const startedAt = Date.now();
    const limited = await withRateLimit(req, "operator");
    if (limited) return limited;

    const auth = await authenticateOperatorApiKey(req);
    if (auth instanceof Response) {
      return auth;
    }

    const scopeErr = requireOperatorScope(auth, "operator:propose");
    if (scopeErr) {
      void logOperatorApiRequest({
        ctx: auth,
        req,
        statusCode: 403,
        startedAt,
      });
      return scopeErr;
    }

    const response = await handler(req, ctx, auth);
    void logOperatorApiRequest({
      ctx: auth,
      req,
      statusCode: response.status,
      startedAt,
    });

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(OPERATOR_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}
