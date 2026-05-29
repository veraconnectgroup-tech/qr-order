import { describe, expect, it, vi } from "vitest";
import { persistBelegArtifact } from "@/lib/fiscal/runtime/persist-fiscal-artifact";

vi.mock("@/lib/fiscal/beleg", () => ({
  buildBelegHtml: vi.fn().mockResolvedValue("<html>beleg</html>"),
}));

describe("persistBelegArtifact", () => {
  it("skips when no signed sale journal row", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              })),
            })),
          })),
        })),
      })),
    };

    const result = await persistBelegArtifact(admin as never, {
      orderId: "order-1",
      snapshot: {
        orgName: "Test",
        locationName: "Loc",
        tableName: null,
        orderNumber: 1,
        createdAt: new Date().toISOString(),
        subtotal: 10,
        taxAmount: 2,
        total: 12,
        currency: "EUR",
        paymentMethod: "online",
        paymentStatus: "paid",
        items: [],
        tseSignature: "sig",
        tseData: { signature: "sig" },
      },
    });

    expect(result.persisted).toBe(false);
  });
});
