import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "export"
  | "fiscal";

export type AuditLogParams = {
  orgId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  request?: NextRequest;
};

function toJson(value: unknown): Json | null {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    const admin = createAdminClient();
    const ip = params.request ? getClientIp(params.request) : null;
    const userAgent = params.request?.headers.get("user-agent") ?? null;

    const { error } = await admin.from("audit_log" as never).insert({
      org_id: params.orgId,
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_value: toJson(params.oldValue),
      new_value: toJson(params.newValue),
      ip_address: ip && ip !== "unknown" ? ip : null,
      user_agent: userAgent,
    } as never);

    if (error) {
      logger.warn("audit_log insert failed", {
        orgId: params.orgId,
        action: params.action,
        entityType: params.entityType,
        error: error.message,
      });
    }
  } catch (error) {
    logger.warn("audit_log insert threw", {
      orgId: params.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
