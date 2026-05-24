import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { createServerClient } from "@/lib/supabase/server";

/** Production rate-limit scopes — see README § Rate limiting */
export type RateLimitScope =
  | "orders"
  | "orders-staff"
  | "orders-guest"
  | "sessions"
  | "bill"
  | "payments"
  | "export"
  | "fiscal"
  | "jobs"
  | "ai"
  | "waiter-calls"
  | "feedback"
  | "push"
  | "pin-verify"
  | "default";

const SCOPE_BY_USER = new Set<RateLimitScope>([
  "export",
  "fiscal",
  "orders-staff",
]);

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);

const redis =
  useRedis && redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

function createScopeLimiter(
  scope: RateLimitScope,
  limit: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `rl:${scope}`,
  });
}

const upstashLimiters: Record<RateLimitScope, Ratelimit | null> = {
  orders: createScopeLimiter("orders", 120, "1 m"),
  "orders-staff": createScopeLimiter("orders-staff", 600, "1 m"),
  "orders-guest": createScopeLimiter("orders-guest", 120, "1 m"),
  sessions: createScopeLimiter("sessions", 30, "1 m"),
  bill: createScopeLimiter("bill", 5, "1 m"),
  payments: createScopeLimiter("payments", 30, "1 m"),
  export: createScopeLimiter("export", 10, "1 m"),
  fiscal: createScopeLimiter("fiscal", 10, "1 m"),
  jobs: createScopeLimiter("jobs", 120, "1 m"),
  ai: createScopeLimiter("ai", 60, "1 m"),
  "waiter-calls": createScopeLimiter("waiter-calls", 3, "1 m"),
  feedback: createScopeLimiter("feedback", 5, "1 m"),
  push: createScopeLimiter("push", 10, "1 m"),
  "pin-verify": createScopeLimiter("pin-verify", 5, "15 m"),
  default: createScopeLimiter("default", 60, "1 m"),
};

// In-memory fallback for local dev without Redis
const rateLimits = new Map<string, { count: number; resetAt: number }>();

const MEMORY_SCOPE_CONFIG: Record<
  RateLimitScope,
  { limit: number; windowMs: number }
> = {
  orders: { limit: 120, windowMs: 60 * 1000 },
  "orders-staff": { limit: 600, windowMs: 60 * 1000 },
  "orders-guest": { limit: 120, windowMs: 60 * 1000 },
  sessions: { limit: 30, windowMs: 60 * 1000 },
  bill: { limit: 5, windowMs: 60 * 1000 },
  payments: { limit: 30, windowMs: 60 * 1000 },
  export: { limit: 10, windowMs: 60 * 1000 },
  fiscal: { limit: 10, windowMs: 60 * 1000 },
  jobs: { limit: 120, windowMs: 60 * 1000 },
  ai: { limit: 60, windowMs: 60 * 1000 },
  "waiter-calls": { limit: 3, windowMs: 60 * 1000 },
  feedback: { limit: 5, windowMs: 60 * 1000 },
  push: { limit: 10, windowMs: 60 * 1000 },
  "pin-verify": { limit: 5, windowMs: 15 * 60 * 1000 },
  default: { limit: 60, windowMs: 60 * 1000 },
};

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const record = rateLimits.get(key);

  if (!record || now > record.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function getRateLimitUserId(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function tooManyRequests(retryAfterSeconds: number): NextResponse {
  const response = apiError("Too many requests", 429);
  response.headers.set(
    "Retry-After",
    String(Math.max(1, retryAfterSeconds))
  );
  return response;
}

async function resolveRateLimitKey(
  req: NextRequest,
  scope: RateLimitScope
): Promise<string> {
  const ip = getClientIp(req);

  if (SCOPE_BY_USER.has(scope)) {
    const userId = await getRateLimitUserId();
    return `${scope}:${userId ?? ip}`;
  }

  return `${scope}:${ip}`;
}

const LOAD_TEST_SCOPES = new Set<RateLimitScope>([
  "orders",
  "orders-staff",
  "orders-guest",
  "sessions",
]);

export async function withStaffRateLimit(
  req: NextRequest
): Promise<NextResponse | null> {
  if (process.env.LOAD_TEST === "true") {
    return null;
  }

  const userId = await getRateLimitUserId();
  if (userId) {
    return withRateLimitByKey("orders-staff", userId);
  }

  return withRateLimit(req, "orders-guest");
}

export async function withRateLimit(
  req: NextRequest,
  scope: RateLimitScope
): Promise<NextResponse | null> {
  if (
    process.env.LOAD_TEST === "true" &&
    LOAD_TEST_SCOPES.has(scope)
  ) {
    return null;
  }

  const key = await resolveRateLimitKey(req, scope);
  const limiter = upstashLimiters[scope];

  if (useRedis && limiter) {
    const result = await limiter.limit(key);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      return tooManyRequests(retryAfter);
    }

    return null;
  }

  const config = MEMORY_SCOPE_CONFIG[scope];
  if (!checkRateLimit(key, config.limit, config.windowMs)) {
    const retryAfter = Math.ceil(config.windowMs / 1000);
    return tooManyRequests(retryAfter);
  }

  return null;
}

export async function withRateLimitByKey(
  scope: RateLimitScope,
  identifier: string
): Promise<NextResponse | null> {
  const key = `${scope}:${identifier}`;
  const limiter = upstashLimiters[scope];

  if (useRedis && limiter) {
    const result = await limiter.limit(key);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      return tooManyRequests(retryAfter);
    }

    return null;
  }

  const config = MEMORY_SCOPE_CONFIG[scope];
  if (!checkRateLimit(key, config.limit, config.windowMs)) {
    const retryAfter = Math.ceil(config.windowMs / 1000);
    return tooManyRequests(retryAfter);
  }

  return null;
}
