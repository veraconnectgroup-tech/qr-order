import { describe, expect, it } from "vitest";
import { formatFiskalyAmount } from "@/lib/fiscal/sign-transaction";

describe("formatFiskalyAmount", () => {
  it("formats negative storno amounts with two decimal places", () => {
    expect(formatFiskalyAmount(-18.5)).toBe("-18.50");
  });

  it("formats positive amounts with two decimal places", () => {
    expect(formatFiskalyAmount(18.5)).toBe("18.50");
  });
});
