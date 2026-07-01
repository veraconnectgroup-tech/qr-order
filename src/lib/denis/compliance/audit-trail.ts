import { createHash } from "crypto";

export const DEFAULT_AUDIT_RETENTION_DAYS = 30;
export const ALLERGY_AUDIT_RETENTION_DAYS = 180;

export type AllergyAuditDetail = {
  conflicts: Array<{
    productId: string;
    productName: string;
    allergen: string;
    severity: "warn" | "block";
  }>;
  knownAllergieLabels: string[];
  allergyAcknowledged: boolean;
  orderId: string | null;
};

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

export function hashGuestInput(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function buildAuditEntry(input: {
  traceId: string;
  sessionId: string;
  guestMessage: string;
  denisResponse: string;
  turnPlan: { kind: string; reason?: string };
  tier: string;
  llmUsed: boolean;
  model: string;
  latencyMs: number;
  allergyGuard?: {
    safe: boolean;
    conflicts?: AllergyAuditDetail["conflicts"];
    message?: string;
  } | null;
  orderSubmitted: boolean;
  creditsCost: number;
  guestMemoryUsed: boolean;
  evidencePointers: string[];
}): DenisAuditEntry {
  return {
    turnId: input.traceId,
    sessionId: input.sessionId,
    timestamp: new Date().toISOString(),
    guestInputHash: hashGuestInput(input.guestMessage),
    denisResponse: input.denisResponse,
    decisionPath: [
      `plan:${input.turnPlan.kind}`,
      input.turnPlan.reason ? `reason:${input.turnPlan.reason}` : null,
      `tier:${input.tier}`,
      input.llmUsed ? "llm" : "template",
    ].filter((step): step is string => Boolean(step)),
    dataAccessed: [
      ...input.evidencePointers,
      ...(input.guestMemoryUsed ? ["guestMemory"] : []),
    ],
    allergyGuardTriggered: input.allergyGuard?.safe === false,
    orderSubmitted: input.orderSubmitted,
    creditsCost: input.creditsCost,
    model: input.model,
    latencyMs: input.latencyMs,
  };
}

export function auditRetentionDays(input: {
  allergyGuardTriggered: boolean;
}): number {
  return input.allergyGuardTriggered
    ? ALLERGY_AUDIT_RETENTION_DAYS
    : DEFAULT_AUDIT_RETENTION_DAYS;
}

export function buildAllergyAuditDetail(input: {
  guard: {
    safe?: boolean;
    conflicts: AllergyAuditDetail["conflicts"];
    message?: string;
  };
  knownAllergieLabels: string[];
  allergyAcknowledged: boolean;
  orderId?: string | null;
}): AllergyAuditDetail | null {
  if (!input.guard.conflicts.length) return null;
  return {
    conflicts: input.guard.conflicts,
    knownAllergieLabels: input.knownAllergieLabels,
    allergyAcknowledged: input.allergyAcknowledged,
    orderId: input.orderId ?? null,
  };
}

export function formatAllergyAuditBlock(
  rows: Array<{ recordedAt: string; turnId: string; detail: AllergyAuditDetail }>
): string {
  if (!rows.length) return "ALLERGY AUDIT\nNo allergy events.";
  return [
    "ALLERGY AUDIT",
    ...rows.map((row) => {
      const products = row.detail.conflicts
        .map((conflict) => `${conflict.productName} (${conflict.allergen})`)
        .join(", ");
      return `${row.recordedAt} ${row.turnId}: ${products} order=${row.detail.orderId ?? "none"}`;
    }),
  ].join("\n");
}

export function formatAuditTrailCsv(entries: DenisAuditEntry[]): string {
  return [
    "turnId,sessionId,timestamp,allergyGuardTriggered,orderSubmitted,creditsCost,model,latencyMs",
    ...entries.map((entry) =>
      [
        entry.turnId,
        entry.sessionId,
        entry.timestamp,
        String(entry.allergyGuardTriggered),
        String(entry.orderSubmitted),
        String(entry.creditsCost),
        entry.model,
        String(entry.latencyMs),
      ].join(",")
    ),
  ].join("\n");
}
