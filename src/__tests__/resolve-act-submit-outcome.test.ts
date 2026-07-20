import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  isActSubmitLive,
  resolveActSubmitOutcome,
} from "@/lib/denis/runtime/act/resolve-act-submit-outcome";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";

describe("F8-3 act submit outcome", () => {
  it("isActSubmitLive requires act layer, submit flag, and no dry-run", () => {
    // Live by default now — act layer, submit, and no dry-run all ship on.
    expect(isActSubmitLive(CONCIERGE_PLATFORM_DEFAULTS)).toBe(true);

    const dryRun = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      ordering: {
        ...CONCIERGE_PLATFORM_DEFAULTS.ordering,
        actDryRun: true,
      },
    };
    expect(isActSubmitLive(dryRun)).toBe(false);
  });

  it("resolveActSubmitOutcome ignores dry-run submit", () => {
    const phase: ActPhaseResult = {
      enabled: true,
      dryRun: true,
      results: [
        {
          skillId: "order.submit",
          riskClass: "R5",
          dryRun: true,
          ok: true,
          detail: { previewOnly: true },
        },
      ],
    };
    expect(resolveActSubmitOutcome(phase)).toEqual({ attempted: false });
  });

  it("resolveActSubmitOutcome returns order number on live success", () => {
    const phase: ActPhaseResult = {
      enabled: true,
      dryRun: false,
      results: [
        {
          skillId: "order.submit",
          riskClass: "R5",
          dryRun: false,
          ok: true,
          detail: { orderNumber: 42, orderId: "ord-1" },
        },
      ],
    };
    expect(resolveActSubmitOutcome(phase)).toEqual({
      attempted: true,
      orderNumber: 42,
      orderId: "ord-1",
    });
  });

  it("resolveActSubmitOutcome forwards approval and sessionOpened", () => {
    const phase: ActPhaseResult = {
      enabled: true,
      dryRun: false,
      results: [
        {
          skillId: "order.submit",
          riskClass: "R5",
          dryRun: false,
          ok: true,
          detail: {
            orderNumber: 7,
            orderId: "ord-7",
            awaitingApproval: true,
            sessionOpened: null,
          },
        },
      ],
    };
    expect(resolveActSubmitOutcome(phase)).toEqual({
      attempted: true,
      orderNumber: 7,
      orderId: "ord-7",
      awaitingApproval: true,
    });
  });

  it("resolveActSubmitOutcome maps empty_cart to guest message", () => {
    const phase: ActPhaseResult = {
      enabled: true,
      dryRun: false,
      results: [
        {
          skillId: "order.submit",
          riskClass: "R5",
          dryRun: false,
          ok: false,
          error: "empty_cart",
        },
      ],
    };
    const outcome = resolveActSubmitOutcome(phase);
    expect(outcome.attempted).toBe(true);
    expect(outcome.submitError).toBe("empty_cart");
    expect(outcome.guestBlockedReason).toContain("Korpa je prazna");
  });
});
