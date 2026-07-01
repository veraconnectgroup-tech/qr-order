import { describe, expect, it, vi, beforeEach } from "vitest";
import { replayPendingFiscalTransactions } from "@/lib/fiscal/runtime/replay-pending-fiscal-transactions";

const mockSignSale = vi.fn();
const mockSignStorno = vi.fn();
const mockSignZClosing = vi.fn();

vi.mock("@/lib/fiscal/fiskaly", () => ({
  isFiskalyConfigured: () => true,
}));

vi.mock("@/lib/fiscal/runtime/sign-journal-transaction", () => ({
  signFiscalJournalTransaction: (...args: unknown[]) => mockSignSale(...args),
  signFiscalJournalStorno: (...args: unknown[]) => mockSignStorno(...args),
}));

vi.mock("@/lib/fiscal/runtime/sign-journal-z-closing", () => ({
  signFiscalJournalZClosing: (...args: unknown[]) => mockSignZClosing(...args),
}));

function buildAdminMock(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    from: vi.fn(() => chain),
  };
}

describe("replayPendingFiscalTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignSale.mockResolvedValue({ signature: "signed-sale" });
    mockSignStorno.mockResolvedValue(null);
    mockSignZClosing.mockResolvedValue({ signature: "signed-z" });
  });

  it("retries pending sale and storno journal rows when TSE was offline", async () => {
    const admin = buildAdminMock([
      {
        id: "tx-sale-1",
        tx_type: "sale",
        order_id: "order-1",
        location_id: "loc-1",
        org_id: "org-1",
      },
      {
        id: "tx-storno-1",
        tx_type: "storno",
        order_id: "order-1",
        location_id: "loc-1",
        org_id: "org-1",
      },
    ]);

    const result = await replayPendingFiscalTransactions(admin as never, {
      limit: 10,
    });

    expect(result.attempted).toBe(2);
    expect(result.signed).toBe(1);
    expect(result.stillPending).toBe(1);
    expect(mockSignSale).toHaveBeenCalledWith("tx-sale-1");
    expect(mockSignStorno).toHaveBeenCalledWith("tx-storno-1");
  });
});
