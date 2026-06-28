import { describe, expect, it } from "vitest";
import {
  buildTurnTrace,
  estimateTurnCostUsd,
  withTiming,
} from "@/lib/denis/runtime/turn-trace";
import { normalizeForScreening as shieldNormalize } from "@/lib/ai/prompt-shield";
import { DATA_RETENTION, retentionCutoffIso } from "@/lib/data-retention";
import { ERROR_CODES, mapStatusToErrorCode } from "@/lib/api-error-client";
import fs from "node:fs";
import path from "node:path";

describe("turn-trace", () => {
  it("builds a complete trace with all phases", () => {
    const trace = buildTurnTrace({
      traceId: "trace-1",
      aiSessionId: "session-1",
      locationId: "loc-1",
      guestInput: "Dva piva",
      language: "sr",
      orgId: "org-1",
      creditsRemaining: 42,
      contextMs: 12,
      legacyMs: 180,
      actMs: 8,
      narrateMs: 45,
      totalMs: 250,
      tier: "t0",
      planKind: "reflex",
      llmUsed: false,
      cartActionCount: 1,
      submitTriggered: false,
      obligationFired: false,
      denisResponse: "Dodao sam dva piva.",
      quickReplies: ["Još nešto?"],
    });

    expect(trace.phases.context.durationMs).toBe(12);
    expect(trace.phases.perceive.durationMs).toBe(180);
    expect(trace.phases.act.cartActions).toBe(1);
    expect(trace.phases.narrate.outputLength).toBeGreaterThan(0);
    expect(trace.totalDurationMs).toBe(250);
  });

  it("estimates token cost", () => {
    const cost = estimateTurnCostUsd(1000, 200);
    expect(cost).toBeGreaterThan(0);
  });

  it("measures async timing", async () => {
    const { durationMs } = await withTiming(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "ok";
    });
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("data-retention", () => {
  it("defines retention windows", () => {
    expect(DATA_RETENTION.turnTraces.days).toBe(7);
    expect(DATA_RETENTION.aiSessions.days).toBe(90);
    expect(DATA_RETENTION.orders.days).toBe(730);
  });

  it("computes cutoff ISO timestamps", () => {
    const now = new Date("2026-06-27T12:00:00.000Z");
    const cutoff = retentionCutoffIso(7, now);
    expect(cutoff).toBe("2026-06-20T12:00:00.000Z");
  });
});

describe("api error contract", () => {
  it("maps HTTP status to error codes", () => {
    expect(mapStatusToErrorCode(429)).toBe(ERROR_CODES.RATE_LIMITED);
    expect(mapStatusToErrorCode(401)).toBe(ERROR_CODES.UNAUTHORIZED);
  });
});

describe("database health audit", () => {
  it("TypeScript database types include denis_turn_traces", () => {
    const typesPath = path.join(process.cwd(), "src/types/database.ts");
    const sql = fs.readFileSync(typesPath, "utf8");
    expect(sql).toContain("denis_turn_traces:");
    expect(sql).toContain("trace_data: Json");
  });

  it("migration 00133 adds FK indexes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/00133_health_audit_indexes.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("idx_orders_location_id");
    expect(sql).toContain("idx_ai_sessions_location_created");
    expect(sql).toContain("idx_order_items_order_id");
  });

  it("denis_turn_traces migration enables RLS", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/00132_denis_turn_traces.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("denis_turn_traces");
  });
});

describe("prompt shield re-export sanity", () => {
  it("shares normalization between modules", () => {
    expect(shieldNormalize("ign⁰re")).toContain("ignore");
  });
});

const RATE_LIMIT_GUARD_PATTERN =
  /withApiGuard|withRateLimit|withGuestRateLimits|withCronRateLimit|withRateLimitByKey|withStaffRateLimit|withOrgRateLimit|withOperatorReadRoute|withOperatorProposeRoute/;

describe("AE2 — API rate limit coverage", () => {
  it("every src/app/api route applies a rate-limit guard", () => {
    const apiRoot = path.join(process.cwd(), "src/app/api");
    const routeFiles: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "route.ts") routeFiles.push(full);
      }
    }

    walk(apiRoot);

    const unprotected = routeFiles.filter(
      (file) => !RATE_LIMIT_GUARD_PATTERN.test(fs.readFileSync(file, "utf8"))
    );

    expect(unprotected, unprotected.join("\n")).toEqual([]);
  });
});
