import { describe, expect, it } from "vitest";
import {
  isHandoffBillRequestMessage,
  isOrderCancelMessage,
  isOrderModifyMessage,
  perceiveTableGuestCommand,
} from "@/lib/denis/commands/perceive-table-guest-command";
import {
  orderSubmitNotAttemptedMessage,
  orderSubmitSuccessMessage,
} from "@/lib/denis/runtime/act/commit-outcome-messages";
import { resolveActOrderChangeOutcome } from "@/lib/denis/runtime/act/resolve-act-order-change-outcome";

describe("handoff bill phrases", () => {
  it("detects Serbian pay and bill requests", () => {
    expect(isHandoffBillRequestMessage("želim da platim")).toBe(true);
    expect(isHandoffBillRequestMessage("hocu da platim")).toBe(true);
    expect(isHandoffBillRequestMessage("pošalji mi račun")).toBe(true);
    expect(isHandoffBillRequestMessage("racun molim")).toBe(true);
    expect(isHandoffBillRequestMessage("moze weizen")).toBe(false);
  });

  it("maps bill request to HANDOFF_PAY command", () => {
    const result = perceiveTableGuestCommand({
      message: "želim da platim",
    });
    expect(result?.intent).toBe("HANDOFF_PAY");
    expect(result?.command.type).toBe("BILL.REQUEST");
  });
});

describe("order change phrases", () => {
  it("detects cancel and modify requests", () => {
    expect(isOrderCancelMessage("otkaži porudžbinu")).toBe(true);
    expect(isOrderCancelMessage("poništite porudžbinu")).toBe(true);
    expect(isOrderModifyMessage("promeni porudžbinu")).toBe(true);
    expect(isOrderModifyMessage("ne to, drugačije")).toBe(true);
  });

  it("does not treat side substitution as order modify", () => {
    expect(
      isOrderModifyMessage(
        "jedno pivo, veliki beef burger sa kartoffel salatom umesto pomfrita"
      )
    ).toBe(false);
    expect(isOrderModifyMessage("burger sa salatom umesto pomfrita")).toBe(false);
    expect(perceiveTableGuestCommand({
      message: "jedno pivo, veliki beef burger sa kartoffel salatom umesto pomfrita",
    })).toBeNull();
  });

  it("maps cancel to ORDER_CANCEL command", () => {
    const result = perceiveTableGuestCommand({ message: "otkaži porudžbinu" });
    expect(result?.intent).toBe("ORDER_CANCEL");
    expect(result?.command.type).toBe("ORDER.CANCEL");
  });

  it("narrates guest cancel success", () => {
    const outcome = resolveActOrderChangeOutcome(
      {
        enabled: true,
        dryRun: false,
        results: [
          {
            skillId: "order.cancel",
            riskClass: "R4",
            dryRun: false,
            ok: true,
            detail: { kind: "cancelled", orderNumber: 9 },
          },
        ],
      },
      "sr"
    );
    expect(outcome.guestMessage).toContain("#9");
    expect(outcome.overrideLegacy).toBe(true);
  });
});

describe("commit outcome messages", () => {
  it("uses order number in success copy", () => {
    expect(orderSubmitSuccessMessage({ language: "sr", orderNumber: 12 })).toContain(
      "#12"
    );
    expect(orderSubmitSuccessMessage({ language: "sr", orderNumber: 12 })).toMatch(
      /kuhinj/i
    );
  });

  it("honest not-attempted copy in Serbian", () => {
    expect(orderSubmitNotAttemptedMessage("sr")).toMatch(/nisam mogao/i);
  });
});
