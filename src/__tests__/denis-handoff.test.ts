import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  isHandoffBillRequestMessage,
  isHandoffWaiterMessage,
  parseHandoffPaymentMethod,
  perceiveTableGuestCommand,
} from "@/lib/denis/commands/perceive-table-guest-command";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { resolveActHandoffOutcome } from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";

describe("perceiveTableGuestCommand M28", () => {
  it("detects waiter typo in English", () => {
    expect(isHandoffWaiterMessage("Call a weiter please")).toBe(true);
    expect(isHandoffWaiterMessage("Can you please call a weiter")).toBe(true);
    const perceived = perceiveTableGuestCommand({
      message: "Call a weiter please",
    });
    expect(perceived?.intent).toBe("HANDOFF_WAITER");
  });

  it("detects waiter call in Serbian", () => {
    expect(isHandoffWaiterMessage("Možeš li da mi pozoveš konobara")).toBe(
      true
    );
    const perceived = perceiveTableGuestCommand({
      message: "Možeš li da mi pozoveš konobara",
    });
    expect(perceived?.intent).toBe("HANDOFF_WAITER");
  });

  it("detects bill request without method", () => {
    expect(isHandoffBillRequestMessage("Denise, pošalji nam račun")).toBe(
      true
    );
    const perceived = perceiveTableGuestCommand({
      message: "Denise, pošalji nam račun",
    });
    expect(perceived?.intent).toBe("HANDOFF_PAY");
    expect(perceived?.paymentMethod).toBeNull();
  });

  it("detects cash payment method", () => {
    expect(parseHandoffPaymentMethod("Kes")).toBe("at_bar");
    const perceived = perceiveTableGuestCommand({ message: "Kes" });
    expect(perceived?.paymentMethod).toBe("at_bar");
  });

  it("uses structured intent for chips", () => {
    const perceived = perceiveTableGuestCommand({
      message: "ignored",
      structuredIntent: "HANDOFF_WAITER",
    });
    expect(perceived?.command.type).toBe("WAITER.REQUEST");
  });

  it("carries the guest's own words as reason on free-text detection — 'find a way' directive", () => {
    const perceived = perceiveTableGuestCommand({
      message: "Treba mi konobar, hoću da promenim porudžbinu",
    });
    expect(perceived?.command).toEqual({
      type: "WAITER.REQUEST",
      reason: "Treba mi konobar, hoću da promenim porudžbinu",
    });
  });

  it("a chip tap carries no reason — nothing more to relay than the button press itself", () => {
    const perceived = perceiveTableGuestCommand({
      message: "ignored",
      structuredIntent: "HANDOFF_WAITER",
    });
    expect(perceived?.command).toEqual({ type: "WAITER.REQUEST" });
  });

  it("caps an unusually long message to the reason column's own length guard", () => {
    const longMessage = `treba mi konobar ${"x".repeat(600)}`;
    const perceived = perceiveTableGuestCommand({ message: longMessage });
    expect(perceived?.command.type).toBe("WAITER.REQUEST");
    if (perceived?.command.type === "WAITER.REQUEST") {
      expect(perceived.command.reason?.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("planTurnWithReflex handoff M28", () => {
  it("plans handoff.waiter skill", () => {
    const turn = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "pozovi konobara",
      flowNodeId: "welcome",
    });
    expect(turn.handoffCommand?.type).toBe("WAITER.REQUEST");
    expect(turn.plan.skills.map((s) => s.id)).toContain("handoff.waiter");
  });

  it("plans handoff.payment for bill request", () => {
    const turn = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "pošalji račun",
      flowNodeId: "post_submit",
    });
    expect(turn.plan.skills.map((s) => s.id)).toContain("handoff.payment");
    expect(turn.plan.topGoal?.type).toBe("HANDOFF");
  });
});

describe("resolveActHandoffOutcome M28", () => {
  it("returns ask payment method when act needs method", () => {
    const outcome = resolveActHandoffOutcome(
      {
        enabled: true,
        dryRun: false,
        results: [
          {
            skillId: "handoff.payment",
            riskClass: "R1",
            dryRun: false,
            ok: true,
            detail: { needsMethod: true },
          },
        ],
      },
      "sr"
    );
    expect(outcome.overrideLegacy).toBe(true);
    expect(outcome.guestMessage).toContain("Kako plaćate");
    expect(outcome.quickReplies).toEqual(["Kes", "Kartica", "Online"]);
  });

  it("returns on my way for successful waiter call", () => {
    const outcome = resolveActHandoffOutcome(
      {
        enabled: true,
        dryRun: false,
        results: [
          {
            skillId: "handoff.waiter",
            riskClass: "R3",
            dryRun: false,
            ok: true,
            detail: { tableName: "T5" },
          },
        ],
      },
      "sr"
    );
    expect(outcome.guestMessage).toContain("Na putu sam");
  });
});
