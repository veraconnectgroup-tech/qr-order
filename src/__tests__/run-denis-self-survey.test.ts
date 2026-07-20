import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { redisGetMock, redisSetMock } = vi.hoisted(() => ({
  redisGetMock: vi.fn().mockResolvedValue(null),
  redisSetMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/redis", () => ({
  getAiRedis: () => ({ get: redisGetMock, set: redisSetMock }),
}));

vi.mock("@/lib/denis/stations/denis-commitments", () => ({
  listDueCommitments: vi.fn().mockResolvedValue([]),
}));

const LOCATION_ID = "loc-1";
const ORG_ID = "org-1";

/** Fake admin covering locations, orders (+order_items), denis_missions, table_sessions. */
function makeFakeAdmin(seed: {
  orders?: Array<{
    id: string;
    status: string;
    order_items: Array<{ menu_section: string; quantity: number }>;
  }>;
  missions?: Array<{ title: string }>;
  activeTableCount?: number;
}) {
  const orders = seed.orders ?? [];
  const missions = seed.missions ?? [];
  const activeTableCount = seed.activeTableCount ?? 0;
  const createdMissions: Record<string, unknown>[] = [];

  function from(table: string) {
    if (table === "locations") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [{ id: LOCATION_ID, org_id: ORG_ID }], error: null }),
        }),
      };
    }
    if (table === "orders") {
      return {
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: orders, error: null }),
          }),
        }),
      };
    }
    if (table === "denis_missions") {
      const api = {
        select: () => api,
        eq: () => api,
        order: () => api,
        limit: () => Promise.resolve({ data: missions, error: null }),
        insert(payload: Record<string, unknown>) {
          return {
            select: () => ({
              maybeSingle: async () => {
                const row = { id: `mission-${createdMissions.length + 1}`, status: "open", ...payload };
                createdMissions.push(row);
                return { data: row, error: null };
              },
            }),
          };
        },
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return api;
    }
    if (table === "table_sessions") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ count: activeTableCount, data: null, error: null }),
          }),
        }),
      };
    }
    throw new Error(`fake admin: unexpected table ${table}`);
  }

  return { admin: { from } as unknown as SupabaseClient, createdMissions };
}

describe("runDenisSelfSurveyTick — Denis's own self-directed venue check", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    redisGetMock.mockClear();
    redisSetMock.mockClear();
  });

  it("skips locations where ops.selfSurvey.enabled is false (the default)", async () => {
    vi.doMock("@/lib/denis/config/load-concierge-config", () => ({
      loadConciergeConfigForLocation: vi.fn().mockResolvedValue({
        ops: { selfSurvey: { enabled: false, cooldownMinutes: 20 } },
      }),
    }));
    const assessMock = vi.fn();
    vi.doMock("@/lib/denis/cognition/perceive/assess-venue-survey", () => ({
      assessVenueSurvey: assessMock,
    }));
    const { runDenisSelfSurveyTick } = await import(
      "@/lib/denis/runtime/run-denis-self-survey"
    );
    const { admin } = makeFakeAdmin({});

    const result = await runDenisSelfSurveyTick(admin);

    expect(result.surveyed).toBe(0);
    expect(assessMock).not.toHaveBeenCalled();
  });

  it("respects the per-location cooldown — skips when Redis already has the key", async () => {
    redisGetMock.mockResolvedValueOnce("1");
    vi.doMock("@/lib/denis/config/load-concierge-config", () => ({
      loadConciergeConfigForLocation: vi.fn().mockResolvedValue({
        ops: { selfSurvey: { enabled: true, cooldownMinutes: 20 } },
      }),
    }));
    const assessMock = vi.fn();
    vi.doMock("@/lib/denis/cognition/perceive/assess-venue-survey", () => ({
      assessVenueSurvey: assessMock,
    }));
    const { runDenisSelfSurveyTick } = await import(
      "@/lib/denis/runtime/run-denis-self-survey"
    );
    const { admin } = makeFakeAdmin({});

    const result = await runDenisSelfSurveyTick(admin);

    expect(result.skippedCooldown).toBe(1);
    expect(result.surveyed).toBe(0);
    expect(assessMock).not.toHaveBeenCalled();
  });

  it("creates a mission when the LLM decides something needs attention", async () => {
    vi.doMock("@/lib/denis/config/load-concierge-config", () => ({
      loadConciergeConfigForLocation: vi.fn().mockResolvedValue({
        ops: { selfSurvey: { enabled: true, cooldownMinutes: 20 } },
      }),
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-venue-survey", () => ({
      assessVenueSurvey: vi.fn().mockResolvedValue({
        needsAttention: true,
        title: "Kitchen backlog building",
        summary: "20 items queued with no sign of easing.",
        urgency: "urgent",
        reasoning: "Kitchen queue depth is well above normal and rush mode is active.",
      }),
    }));
    const { runDenisSelfSurveyTick } = await import(
      "@/lib/denis/runtime/run-denis-self-survey"
    );
    const { admin, createdMissions } = makeFakeAdmin({
      orders: [
        {
          id: "order-1",
          status: "preparing",
          order_items: [{ menu_section: "food", quantity: 20 }],
        },
      ],
    });

    const result = await runDenisSelfSurveyTick(admin);

    expect(result.surveyed).toBe(1);
    expect(result.missionsCreated).toBe(1);
    expect(createdMissions).toHaveLength(1);
    expect(createdMissions[0]).toMatchObject({
      kind: "custom",
      org_id: ORG_ID,
      location_id: LOCATION_ID,
      title: "Kitchen backlog building",
      priority: "urgent",
    });
    expect(
      (createdMissions[0].payload as Record<string, unknown>).selfInitiated
    ).toBe(true);
  });

  it("does not create a mission when the LLM says nothing needs attention", async () => {
    vi.doMock("@/lib/denis/config/load-concierge-config", () => ({
      loadConciergeConfigForLocation: vi.fn().mockResolvedValue({
        ops: { selfSurvey: { enabled: true, cooldownMinutes: 20 } },
      }),
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-venue-survey", () => ({
      assessVenueSurvey: vi.fn().mockResolvedValue({
        needsAttention: false,
        title: null,
        summary: null,
        urgency: null,
        reasoning: "Ordinary shift, nothing building up.",
      }),
    }));
    const { runDenisSelfSurveyTick } = await import(
      "@/lib/denis/runtime/run-denis-self-survey"
    );
    const { admin, createdMissions } = makeFakeAdmin({});

    const result = await runDenisSelfSurveyTick(admin);

    expect(result.surveyed).toBe(1);
    expect(result.missionsCreated).toBe(0);
    expect(createdMissions).toHaveLength(0);
  });

  it("degrades gracefully when the LLM call fails (returns null)", async () => {
    vi.doMock("@/lib/denis/config/load-concierge-config", () => ({
      loadConciergeConfigForLocation: vi.fn().mockResolvedValue({
        ops: { selfSurvey: { enabled: true, cooldownMinutes: 20 } },
      }),
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-venue-survey", () => ({
      assessVenueSurvey: vi.fn().mockResolvedValue(null),
    }));
    const { runDenisSelfSurveyTick } = await import(
      "@/lib/denis/runtime/run-denis-self-survey"
    );
    const { admin, createdMissions } = makeFakeAdmin({});

    const result = await runDenisSelfSurveyTick(admin);

    expect(result.surveyed).toBe(1);
    expect(result.missionsCreated).toBe(0);
    expect(createdMissions).toHaveLength(0);
  });
});
