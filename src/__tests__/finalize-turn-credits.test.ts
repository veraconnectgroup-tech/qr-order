import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("finalizeTurnCredits", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("is a no-op when nothing was charged this turn", async () => {
    const finalizeTurnMeteringMock = vi.fn();
    vi.doMock("@/lib/denis/commercial", () => ({
      finalizeTurnMetering: finalizeTurnMeteringMock,
      maybeEnqueueLowBalanceAlert: vi.fn(),
      refreshOrgAiOpsProjection: vi.fn(),
    }));
    const { finalizeTurnCredits } = await import(
      "@/lib/denis/runtime/turn/finalize-turn-credits"
    );

    const result = await finalizeTurnCredits({
      admin: {} as SupabaseClient,
      orgId: "org-1",
      locationId: "loc-1",
      timelineAiSessionId: "session-1",
      traceId: "trace-1",
      creditsCharged: 0,
      creditsRemaining: 42,
    });

    expect(result).toEqual({ creditsRemaining: 42, meteringMs: 0 });
    expect(finalizeTurnMeteringMock).not.toHaveBeenCalled();
  });

  it("is a no-op when there's no timeline session id, even if credits were charged", async () => {
    const finalizeTurnMeteringMock = vi.fn();
    vi.doMock("@/lib/denis/commercial", () => ({
      finalizeTurnMetering: finalizeTurnMeteringMock,
      maybeEnqueueLowBalanceAlert: vi.fn(),
      refreshOrgAiOpsProjection: vi.fn(),
    }));
    const { finalizeTurnCredits } = await import(
      "@/lib/denis/runtime/turn/finalize-turn-credits"
    );

    const result = await finalizeTurnCredits({
      admin: {} as SupabaseClient,
      orgId: "org-1",
      locationId: "loc-1",
      timelineAiSessionId: null,
      traceId: "trace-1",
      creditsCharged: 1,
      creditsRemaining: 42,
    });

    expect(result).toEqual({ creditsRemaining: 42, meteringMs: 0 });
    expect(finalizeTurnMeteringMock).not.toHaveBeenCalled();
  });

  it("finalizes metering, updates the balance, and alerts on low balance", async () => {
    const maybeEnqueueLowBalanceAlertMock = vi.fn().mockResolvedValue(undefined);
    const refreshOrgAiOpsProjectionMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/denis/commercial", () => ({
      finalizeTurnMetering: vi.fn().mockResolvedValue({
        ok: true,
        balanceAfter: 17,
      }),
      maybeEnqueueLowBalanceAlert: maybeEnqueueLowBalanceAlertMock,
      refreshOrgAiOpsProjection: refreshOrgAiOpsProjectionMock,
    }));
    const { finalizeTurnCredits } = await import(
      "@/lib/denis/runtime/turn/finalize-turn-credits"
    );

    const result = await finalizeTurnCredits({
      admin: {} as SupabaseClient,
      orgId: "org-1",
      locationId: "loc-1",
      timelineAiSessionId: "session-1",
      traceId: "trace-1",
      creditsCharged: 1,
      creditsRemaining: 42,
    });

    expect(result.creditsRemaining).toBe(17);
    expect(maybeEnqueueLowBalanceAlertMock).toHaveBeenCalledWith(
      {} as SupabaseClient,
      expect.objectContaining({ orgId: "org-1", balanceAfter: 17 })
    );
    expect(refreshOrgAiOpsProjectionMock).toHaveBeenCalledWith(
      {} as SupabaseClient,
      "org-1"
    );
  });

  it("keeps the prior balance and logs an error when metering finalize fails", async () => {
    vi.doMock("@/lib/denis/commercial", () => ({
      finalizeTurnMetering: vi.fn().mockResolvedValue({
        ok: false,
        code: "insufficient_balance",
      }),
      maybeEnqueueLowBalanceAlert: vi.fn(),
      refreshOrgAiOpsProjection: vi.fn(),
    }));
    const { finalizeTurnCredits } = await import(
      "@/lib/denis/runtime/turn/finalize-turn-credits"
    );

    const result = await finalizeTurnCredits({
      admin: {} as SupabaseClient,
      orgId: "org-1",
      locationId: "loc-1",
      timelineAiSessionId: "session-1",
      traceId: "trace-1",
      creditsCharged: 1,
      creditsRemaining: 42,
    });

    expect(result.creditsRemaining).toBe(42);
  });
});
