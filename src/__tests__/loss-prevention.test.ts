import { describe, expect, it } from "vitest";
import { assertTotalPreserved } from "@/lib/loss-prevention/assert-total-preserved";
import { evaluateVoidLadder } from "@/lib/loss-prevention/evaluate-void-ladder";
import {
  buildSuspiciousFlagCopy,
  containsAccusatoryPhrase,
} from "@/lib/loss-prevention/flag-copy";
import {
  evaluateDiscountPattern,
  countDiscountsByStaff,
} from "@/lib/loss-prevention/discount-patterns";
import {
  evaluateDuplicatePayment,
  evaluateSessionCloseBalance,
} from "@/lib/loss-prevention/payment-guardrails";
import { buildSuspiciousDigest } from "@/lib/loss-prevention/build-suspicious-digest";
import { resolveVoidPhaseFromOrderStatus } from "@/lib/loss-prevention/resolve-void-phase";
import {
  evaluateCashPaidWithoutFiscal,
  evaluateCashRefundGuard,
  isCashPaymentMethod,
} from "@/lib/loss-prevention/cash-risk";

describe("ADR-044 loss prevention", () => {
  describe("void ladder", () => {
    it("allows queued void without reason", () => {
      const result = evaluateVoidLadder({
        orderStatus: "accepted",
        paymentStatus: "pending",
        actorRole: "waiter",
      });
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.phase).toBe("queued");
        expect(result.requiresReason).toBe(false);
      }
    });

    it("blocks in_prep void without reason", () => {
      const result = evaluateVoidLadder({
        orderStatus: "preparing",
        paymentStatus: "pending",
        actorRole: "waiter",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.status).toBe(400);
      }
    });

    it("blocks served void without manager", () => {
      const result = evaluateVoidLadder({
        orderStatus: "ready",
        paymentStatus: "pending",
        reason: "guest changed mind",
        actorRole: "waiter",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.status).toBe(403);
      }
    });

    it("blocks paid void", () => {
      const result = evaluateVoidLadder({
        orderStatus: "delivered",
        paymentStatus: "paid",
        actorRole: "manager",
        reason: "test",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.phase).toBe("paid");
        expect(result.status).toBe(409);
      }
    });
  });

  describe("assertTotalPreserved", () => {
    it("passes when totals match", () => {
      expect(assertTotalPreserved(84.5, 84.5).ok).toBe(true);
    });

    it("returns 409 with amounts when mismatch", () => {
      const result = assertTotalPreserved(84.5, 78.5, "Split");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(409);
        expect(result.error).toContain("84.50€");
        expect(result.error).toContain("78.50€");
      }
    });
  });

  describe("payment guardrails", () => {
    it("blocks duplicate payment", () => {
      const result = evaluateDuplicatePayment({
        currentPaymentStatus: "paid",
        requestedAmount: 40,
        openBalance: 0,
      });
      expect(result.allowed).toBe(false);
      expect(result.riskFlag).toBe(true);
    });

    it("requires reason on session close with balance", () => {
      const result = evaluateSessionCloseBalance({
        openBalance: 24.5,
      });
      expect(result.allowed).toBe(false);
      expect(result.requiresReason).toBe(true);
    });
  });

  describe("flag copy tone", () => {
    it("uses neutral verification language", () => {
      const copy = buildSuspiciousFlagCopy({
        action: "void",
        tableName: "6",
        orderNumber: 14,
        voidPhase: "served",
        reasonMissing: true,
      });
      expect(copy).toContain("treba proveru");
      expect(containsAccusatoryPhrase(copy)).toBe(false);
    });
  });

  describe("discount patterns", () => {
    it("flags staff above location average", () => {
      const result = evaluateDiscountPattern({
        staffId: "staff-1",
        discountCount: 6,
        locationAverage: 2,
      });
      expect(result.flagged).toBe(true);
    });

    it("does not flag when whole team discounts", () => {
      const result = evaluateDiscountPattern({
        staffId: "staff-1",
        discountCount: 3,
        locationAverage: 2.5,
      });
      expect(result.flagged).toBe(false);
    });

    it("counts discounts by staff from journal rows", () => {
      const counts = countDiscountsByStaff([
        {
          id: "1",
          sensitive_action: "discount",
          actor_id: "a",
        } as never,
        {
          id: "2",
          sensitive_action: "discount",
          actor_id: "a",
        } as never,
        {
          id: "3",
          sensitive_action: "void",
          actor_id: "b",
        } as never,
      ]);
      expect(counts.get("a")).toBe(2);
    });
  });

  describe("suspicious digest", () => {
    it("caps digest items and reports overflow", () => {
      const flags = Array.from({ length: 12 }, (_, index) => ({
        id: `f-${index}`,
        action: "void",
        orderId: "o1",
        sessionId: null,
        createdAt: new Date().toISOString(),
        reason: null,
        context: {},
        copy: `Flag ${index}`,
        tableName: "4",
        orderNumber: index,
      }));

      const digest = buildSuspiciousDigest(flags, 10);
      expect(digest.shown).toBe(10);
      expect(digest.overflow).toBe(2);
      expect(digest.lines).toHaveLength(10);
    });
  });

  describe("void phase fallback", () => {
    it("maps order status when station rows missing", () => {
      expect(
        resolveVoidPhaseFromOrderStatus("preparing", "pending")
      ).toBe("in_prep");
      expect(resolveVoidPhaseFromOrderStatus("ready", "pending")).toBe(
        "served"
      );
    });
  });

  describe("cash risk (S5)", () => {
    it("detects cash payment methods", () => {
      expect(isCashPaymentMethod("at_bar")).toBe(true);
      expect(isCashPaymentMethod("online")).toBe(false);
    });

    it("flags cash paid without fiscal on fiscalized location", () => {
      const result = evaluateCashPaidWithoutFiscal({
        paymentMethod: "at_bar",
        tseSignature: null,
        fiscalRequired: true,
      });
      expect(result.riskFlag).toBe(true);
    });

    it("does not flag when TSE present", () => {
      const result = evaluateCashPaidWithoutFiscal({
        paymentMethod: "at_bar",
        tseSignature: "TSE-123",
        fiscalRequired: true,
      });
      expect(result.riskFlag).toBe(false);
    });

    it("blocks cash refund without manager", () => {
      const result = evaluateCashRefundGuard({
        paymentMethod: "at_bar",
        reason: "walk-out",
        actorRole: "waiter",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.status).toBe(403);
      }
    });

    it("allows cash refund for manager with reason", () => {
      const result = evaluateCashRefundGuard({
        paymentMethod: "at_bar",
        reason: "walk-out",
        actorRole: "manager",
      });
      expect(result.allowed).toBe(true);
    });
  });
});
