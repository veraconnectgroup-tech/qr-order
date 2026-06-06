import { describe, expect, it } from "vitest";
import { normalizeOperatorPaymentMethod } from "@/lib/operator/fiscal-payment";

describe("normalizeOperatorPaymentMethod", () => {
  it("maps cash methods", () => {
    expect(normalizeOperatorPaymentMethod("at_bar")).toBe("cash");
    expect(normalizeOperatorPaymentMethod("cash")).toBe("cash");
  });

  it("maps card methods", () => {
    expect(normalizeOperatorPaymentMethod("card_terminal")).toBe("card");
    expect(normalizeOperatorPaymentMethod("card_at_table")).toBe("card");
  });

  it("maps online methods", () => {
    expect(normalizeOperatorPaymentMethod("online")).toBe("online");
    expect(normalizeOperatorPaymentMethod("pos_online")).toBe("online");
  });
});
