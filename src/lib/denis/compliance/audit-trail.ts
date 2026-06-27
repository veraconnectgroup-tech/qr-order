import { createHash } from "node:crypto";

import type { AllergyGuardResult } from "@/lib/denis/cognition/safety/allergy-guard";
import type { EvidencePointer } from "@/lib/denis/cognition/context/plan-evidence";

export const DEFAULT_AUDIT_RETENTION_DAYS = 90;
export const ALLERGY_AUDIT_RETENTION_DAYS = 365;

export type DenisAuditEntry = {
  turnId: string;
  sessionId: string;
  timestamp: string;
  guestInputHash: string;
  denisResponse: string;
  decisionPath: string[];
  dataAccessed: string[];
  allergyGuardTriggered: boolean;
  orderSubmitted: boolean;
  creditsCost: number;
  model: string;
  latencyMs: number;
};

export type AllergyAuditDetail = {
  declaredAllergens: string[];
  conflicts: Array<{
    productName: string;
    allergens: string[];
  }>;
  acknowledged: boolean;
  orderId?: string | null;
};

export type AuditSkillResult = {
  skillId: string;
  ok: boolean;
  dryRun: boolean;
};

export type AuditTurnPlan = {
  kind: string;
  reason: string;
};

export type BuildAuditEntryInput = {
  traceId: string;
  sessionId: string | null;
  guestMessage: string;
  denisResponse: string;
  turnPlan: AuditTurnPlan;
  tier: string;
  llmUsed: boolean;
  model: string;
  latencyMs: number;
  evidencePointers?: EvidencePointer[];
  actResults?: AuditSkillResult[];
  actSubmitLive?: boolean;
  allergyGuard: AllergyGuardResult;
  allergyAcknowledged?: boolean;
  orderSubmitted: boolean;
  orderId?: string | null;
  creditsCost: number;
  guestMemoryUsed?: boolean;
  knownAllergieLabels?: string[];
};

/** SHA-256 guest input — never store raw PII in audit log. */
export function hashGuestInput(message: string): string {
  return createHash("sha256")
    .update(message.normalize("NFKC").trim().toLowerCase())
    .digest("hex");
}

function mapEvidenceToDataAccessed(
  pointers: EvidencePointer[] | undefined,
  guestMemoryUsed: boolean
): string[] {
  const accessed = new Set<string>();

  for (const pointer of pointers ?? []) {
    if (pointer.startsWith("commerce")) accessed.add("orders");
    if (pointer === "transcript.window") accessed.add("conversation");
    if (pointer === "situation.pack") {
      accessed.add("menu");
      accessed.add("orders");
      accessed.add("conversation");
    }
    if (pointer === "guest.memory") accessed.add("guestMemory");
    if (pointer === "catalog.rag") accessed.add("menu");
    if (pointer === "venue.ops") accessed.add("venueOps");
    if (pointer === "playbook.examples") accessed.add("playbook");
  }

  if (guestMemoryUsed) accessed.add("guestMemory");

  return [...accessed].sort();
}

function buildDecisionPath(input: {
  tier: string;
  llmUsed: boolean;
  turnPlan: AuditTurnPlan;
  actResults?: AuditSkillResult[];
  actSubmitLive?: boolean;
}): string[] {
  const path: string[] = [
    input.llmUsed ? `${input.tier}_llm` : `${input.tier}_reflex`,
    `plan:${input.turnPlan.kind}`,
    `reason:${input.turnPlan.reason}`,
  ];

  for (const skill of input.actResults ?? []) {
    path.push(`skill:${skill.skillId}:${skill.ok ? "ok" : "fail"}`);
    if (skill.ok && !skill.dryRun) {
      path.push(`ACL:${skill.skillId}:approved`);
    } else if (!skill.ok && !skill.dryRun) {
      path.push(`ACL:${skill.skillId}:rejected`);
    }
  }

  if (input.actSubmitLive) {
    path.push("submit:live");
  }

  return path;
}

export function buildAllergyAuditDetail(input: {
  guard: AllergyGuardResult;
  knownAllergieLabels: string[];
  allergyAcknowledged?: boolean;
  orderId?: string | null;
}): AllergyAuditDetail | null {
  if (input.guard.safe && input.guard.conflicts.length === 0) {
    return input.knownAllergieLabels.length > 0
      ? {
          declaredAllergens: input.knownAllergieLabels,
          conflicts: [],
          acknowledged: Boolean(input.allergyAcknowledged),
          orderId: input.orderId ?? null,
        }
      : null;
  }

  return {
    declaredAllergens: input.knownAllergieLabels,
    conflicts: input.guard.conflicts.map((row) => ({
      productName: row.productName,
      allergens: [row.allergen],
    })),
    acknowledged: Boolean(input.allergyAcknowledged),
    orderId: input.orderId ?? null,
  };
}

export function buildAuditEntry(input: BuildAuditEntryInput): DenisAuditEntry {
  const allergyGuardTriggered =
    !input.allergyGuard.safe && input.allergyGuard.conflicts.length > 0;

  return {
    turnId: input.traceId,
    sessionId: input.sessionId ?? "unknown",
    timestamp: new Date().toISOString(),
    guestInputHash: hashGuestInput(input.guestMessage),
    denisResponse: input.denisResponse.slice(0, 4000),
    decisionPath: buildDecisionPath(input),
    dataAccessed: mapEvidenceToDataAccessed(
      input.evidencePointers,
      Boolean(input.guestMemoryUsed)
    ),
    allergyGuardTriggered,
    orderSubmitted: input.orderSubmitted,
    creditsCost: input.creditsCost,
    model: input.model,
    latencyMs: input.latencyMs,
  };
}

export function auditRetentionDays(input: {
  allergyGuardTriggered: boolean;
  retentionDays?: number;
}): number {
  if (input.allergyGuardTriggered) return ALLERGY_AUDIT_RETENTION_DAYS;
  return input.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
}

export function formatAllergyAuditBlock(
  rows: Array<{
    recordedAt: string;
    detail: AllergyAuditDetail;
    turnId: string;
  }>
): string {
  if (rows.length === 0) return "No allergy audit events.";

  const lines = ["ALLERGY AUDIT:"];
  for (const row of rows) {
    lines.push(`[${row.recordedAt}] turn ${row.turnId.slice(0, 8)}`);
    if (row.detail.declaredAllergens.length) {
      lines.push(
        `  declared: ${row.detail.declaredAllergens.join(", ")}`
      );
    }
    for (const conflict of row.detail.conflicts) {
      lines.push(
        `  ⚠ ${conflict.productName} — ${conflict.allergens.join(", ")}`
      );
    }
    if (row.detail.acknowledged) {
      lines.push("  guest acknowledged after warning");
    }
    if (row.detail.orderId) {
      lines.push(`  order: ${row.detail.orderId}`);
    }
  }
  return lines.join("\n");
}

export function formatAuditTrailCsv(
  rows: Array<
    DenisAuditEntry & {
      recordedAt: string;
      allergyDetail?: AllergyAuditDetail | null;
    }
  >
): string {
  const header = [
    "recorded_at",
    "turn_id",
    "session_id",
    "guest_input_hash",
    "denis_response",
    "decision_path",
    "data_accessed",
    "allergy_guard_triggered",
    "order_submitted",
    "credits_cost",
    "model",
    "latency_ms",
  ].join(",");

  const escape = (value: string) =>
    `"${value.replace(/"/g, '""').replace(/\n/g, " ")}"`;

  const body = rows.map((row) =>
    [
      row.recordedAt,
      row.turnId,
      row.sessionId,
      row.guestInputHash,
      escape(row.denisResponse),
      escape(row.decisionPath.join(" → ")),
      escape(row.dataAccessed.join(";")),
      row.allergyGuardTriggered ? "true" : "false",
      row.orderSubmitted ? "true" : "false",
      String(row.creditsCost),
      row.model,
      String(row.latencyMs),
    ].join(",")
  );

  return [header, ...body].join("\n");
}
