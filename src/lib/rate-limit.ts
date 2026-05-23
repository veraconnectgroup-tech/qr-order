import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const rateLimits = new Map<string, { count: number; resetAt: number }>();

export type RateLimitScope =
  | "orders"
  | "sessions"
  | "payments"
  | "export"
  | "fiscal"
  | "default";

const SCOPE_CONFIG: Record<
  RateLimitScope,
  { limit: number; windowMs: number; byUser?: boolean }
> = {
  orders: { limit: 120, windowMs: 60 * 60 * 1000 },
  sessions: { limit: 60, windowMs: 60 * 1000 },
  payments: { limit: 30, windowMs: 60 * 1000 },
  export: { limit: 10, windowMs: 60 * 1000, byUser: true },
  fiscal: { limit: 10, windowMs: 60 * 1000, byUser: true },
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

export function withRateLimit(
  req: Request,
  key: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  void req;
  if (!checkRateLimit(key, limit, windowMs)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}

export async function withRateLimitScope(
  req: NextRequest,
  scope: RateLimitScope
): Promise<NextResponse | null> {
  const config = SCOPE_CONFIG[scope];
  const ip = getClientIp(req);

  if (config.byUser) {
    const userId = await getRateLimitUserId();
    const key = `${scope}:user:${userId ?? ip}`;
    return withRateLimit(req, key, config.limit, config.windowMs);
  }

  const key = `${scope}:ip:${ip}`;
  return withRateLimit(req, key, config.limit, config.windowMs);
}
