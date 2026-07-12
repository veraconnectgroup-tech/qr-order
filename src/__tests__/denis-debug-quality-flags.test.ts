import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("loadSessionEvalResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns the stored per-session eval result when present", async () => {
    const stored = {
      sessionId: "sess-1",
      scores: { comprehension: 80, accuracy: 90, tone: 100, upsellSuccess: 50, overall: 80 },
      learnings: [],
      anomaly: false,
      evaluatedAt: "2026-06-01T12:00:00.000Z",
    };
    vi.doMock("@/lib/redis/client", () => ({
      getRedisClient: () => ({ get: async () => stored }),
      logRedisDegradation: () => undefined,
    }));
    const { loadSessionEvalResult } = await import(
      "@/lib/denis/eval/continuous-eval-loop"
    );

    const result = await loadSessionEvalResult("sess-1");
    expect(result).toEqual(stored);
  });

  it("returns null when Redis is unavailable, never throws", async () => {
    vi.doMock("@/lib/redis/client", () => ({
      getRedisClient: () => null,
      logRedisDegradation: () => undefined,
    }));
    const { loadSessionEvalResult } = await import(
      "@/lib/denis/eval/continuous-eval-loop"
    );

    expect(await loadSessionEvalResult("sess-1")).toBeNull();
  });

  it("returns null and degrades gracefully when Redis throws", async () => {
    vi.doMock("@/lib/redis/client", () => ({
      getRedisClient: () => ({
        get: async () => {
          throw new Error("connection reset");
        },
      }),
      logRedisDegradation: () => undefined,
    }));
    const { loadSessionEvalResult } = await import(
      "@/lib/denis/eval/continuous-eval-loop"
    );

    expect(await loadSessionEvalResult("sess-1")).toBeNull();
  });
});

describe("listDenisDebugSessions — quality flags and sort", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("floats flagged sessions (mismatch/anomaly) above clean sessions, both newest-first within their group", async () => {
    const evalBySession: Record<string, unknown> = {
      "sess-old-flagged": {
        sessionId: "sess-old-flagged",
        scores: { comprehension: 50, accuracy: 50, tone: 50, upsellSuccess: 50, overall: 40 },
        learnings: [
          {
            id: "l1",
            kind: "mismatch",
            guestMessage: "x",
            denisResponse: "y",
            sessionId: "sess-old-flagged",
            capturedAt: "2026-06-01T00:00:00.000Z",
            confidence: 0.8,
          },
        ],
        anomaly: false,
        evaluatedAt: "2026-06-01T00:00:00.000Z",
      },
      "sess-new-clean": {
        sessionId: "sess-new-clean",
        scores: { comprehension: 95, accuracy: 95, tone: 95, upsellSuccess: 95, overall: 95 },
        learnings: [],
        anomaly: false,
        evaluatedAt: "2026-06-02T00:00:00.000Z",
      },
    };

    vi.doMock("@/lib/denis/eval/continuous-eval-loop", () => ({
      loadSessionEvalResult: async (sessionId: string) =>
        evalBySession[sessionId] ?? null,
    }));

    const { listDenisDebugSessions } = await import("@/lib/admin/denis-debug");

    const sessionRows = [
      {
        id: "sess-new-clean",
        table_id: "t1",
        status: "completed",
        language: "sr",
        created_at: "2026-06-02T00:00:00.000Z",
        tables: { name: "Table 1" },
      },
      {
        id: "sess-old-flagged",
        table_id: "t2",
        status: "completed",
        language: "sr",
        created_at: "2026-06-01T00:00:00.000Z",
        tables: { name: "Table 2" },
      },
    ];

    const admin = {
      from: (table: string) => {
        if (table === "ai_sessions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: sessionRows, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "denis_timeline") {
          return {
            select: () => ({
              in: async () => ({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;

    const rows = await listDenisDebugSessions(admin, "loc-1");

    expect(rows.map((r) => r.id)).toEqual(["sess-old-flagged", "sess-new-clean"]);
    expect(rows[0].qualityFlag?.issueKinds).toEqual(["mismatch"]);
    expect(rows[1].qualityFlag?.issueKinds).toEqual([]);
  });

  it("shows qualityFlag: null for a session with no eval result yet", async () => {
    vi.doMock("@/lib/denis/eval/continuous-eval-loop", () => ({
      loadSessionEvalResult: async () => null,
    }));

    const { listDenisDebugSessions } = await import("@/lib/admin/denis-debug");

    const admin = {
      from: (table: string) => {
        if (table === "ai_sessions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: "sess-1",
                        table_id: "t1",
                        status: "active",
                        language: "sr",
                        created_at: "2026-06-01T00:00:00.000Z",
                        tables: { name: "Table 1" },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({ in: async () => ({ data: [], error: null }) }),
        };
      },
    } as unknown as SupabaseClient;

    const rows = await listDenisDebugSessions(admin, "loc-1");
    expect(rows[0].qualityFlag).toBeNull();
  });
});
