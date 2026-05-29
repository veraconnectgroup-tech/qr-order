import { describe, expect, it } from "vitest";
import {
  isHandoffBillRequestMessage,
  perceiveTableGuestCommand,
} from "@/lib/denis/commands/perceive-table-guest-command";
import {
  orderSubmitNotAttemptedMessage,
  orderSubmitSuccessMessage,
} from "@/lib/denis/runtime/act/commit-outcome-messages";

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
