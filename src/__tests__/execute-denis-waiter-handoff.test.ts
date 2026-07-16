import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const resolveWaiterCallContext = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sessions/resolve-waiter-call-context", () => ({
  resolveWaiterCallContext: (...args: unknown[]) =>
    resolveWaiterCallContext(...args),
}));

vi.mock("@/lib/push/schedule-notify", () => ({
  scheduleWaiterCallPush: vi.fn(),
}));

import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";

describe("executeDenisWaiterHandoff — reason threading (founder's 'find a way' directive)", () => {
  const insert = vi.fn();

  function makeAdmin(): SupabaseClient {
    return {
      from: (table: string) => {
        if (table !== "waiter_calls") throw new Error(`unexpected table ${table}`);
        return { insert };
      },
    } as unknown as SupabaseClient;
  }

  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null });
    resolveWaiterCallContext.mockReset().mockResolvedValue({
      ok: true,
      data: {
        tableId: "table-1",
        locationId: "loc-1",
        tableName: "5",
        sessionId: "session-1",
      },
    });
  });

  it("stores the guest's own words as the reason", async () => {
    const result = await executeDenisWaiterHandoff(makeAdmin(), {
      tableId: "table-1",
      locationId: "loc-1",
      tableToken: "qr-token",
      reason: "Treba mi konobar, hoću da promenim porudžbinu",
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Treba mi konobar, hoću da promenim porudžbinu",
      })
    );
  });

  it("stores null when no reason was given — a plain chip tap has nothing extra to say", async () => {
    await executeDenisWaiterHandoff(makeAdmin(), {
      tableId: "table-1",
      locationId: "loc-1",
      tableToken: "qr-token",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: null })
    );
  });

  it("normalizes a whitespace-only reason to null rather than storing blank text", async () => {
    await executeDenisWaiterHandoff(makeAdmin(), {
      tableId: "table-1",
      locationId: "loc-1",
      tableToken: "qr-token",
      reason: "   ",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: null })
    );
  });
});
