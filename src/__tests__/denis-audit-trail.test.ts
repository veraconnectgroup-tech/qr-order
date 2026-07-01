import { describe, expect, it } from "vitest";
import {
  ALLERGY_AUDIT_RETENTION_DAYS,
  auditRetentionDays,
  buildAllergyAuditDetail,
  buildAuditEntry,
  DEFAULT_AUDIT_RETENTION_DAYS,
  formatAllergyAuditBlock,
  hashGuestInput,
} from "@/lib/denis/compliance/audit-trail";

describe("denis audit trail (V1)", () => {
  it("hashGuestInput never returns raw message", () => {
    const hash = hashGuestInput("alergija na orašaste");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("orašaste");
  });

  it("allergen conflict → allergyGuardTriggered=true in audit entry", () => {
    const entry = buildAuditEntry({
      traceId: "trace-1",
      sessionId: "sess-1",
      guestMessage: "Hoću čokoladnu tortu",
      denisResponse: "Čokoladna torta sadrži orašaste. Želite alternativu?",
      turnPlan: { kind: "transactional_perceive", reason: "order.item" },
      tier: "T2",
      llmUsed: true,
      model: "T2:llm",
      latencyMs: 1200,
      allergyGuard: {
        safe: false,
        conflicts: [
          {
            productId: "p1",
            productName: "Čokoladna torta",
            allergen: "nuts",
            severity: "block" as const,
          },
        ],
        message: "Allergen conflict",
      },
      orderSubmitted: false,
      creditsCost: 1,
      guestMemoryUsed: true,
      evidencePointers: ["situation.pack", "guest.memory"],
    });

    expect(entry.allergyGuardTriggered).toBe(true);
    expect(entry.dataAccessed).toContain("guestMemory");
    expect(entry.decisionPath.some((step) => step.startsWith("plan:"))).toBe(
      true
    );
  });

  it("allergy rows use extended retention", () => {
    expect(
      auditRetentionDays({ allergyGuardTriggered: true })
    ).toBe(ALLERGY_AUDIT_RETENTION_DAYS);
    expect(
      auditRetentionDays({ allergyGuardTriggered: false })
    ).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
  });

  it("buildAllergyAuditDetail captures conflict timeline fields", () => {
    const detail = buildAllergyAuditDetail({
      guard: {
        safe: false,
        conflicts: [
          {
            productId: "p1",
            productName: "Čokoladna torta",
            allergen: "nuts",
            severity: "block" as const,
          },
        ],
        message: "warn",
      },
      knownAllergieLabels: ["orašaste"],
      allergyAcknowledged: true,
      orderId: "order-67",
    });

    expect(detail?.conflicts[0]?.productName).toBe("Čokoladna torta");
    expect(detail?.orderId).toBe("order-67");

    const block = formatAllergyAuditBlock([
      {
        recordedAt: "2026-06-27T14:33:12.000Z",
        turnId: "trace-4521",
        detail: detail!,
      },
    ]);

    expect(block).toContain("ALLERGY AUDIT");
    expect(block).toContain("Čokoladna torta");
    expect(block).toContain("order-67");
  });
});
