import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/redis/client", () => ({
  getRedisClient: () => null,
  logRedisDegradation: vi.fn(),
}));

const dispatchStaffNotification = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ delivered: true })
);
vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification,
}));

import { executeStationGeneralVoiceTool } from "@/lib/denis/agentic/station-general-voice-tool-catalog";

type Row = Record<string, unknown>;

function makeFakeAdmin(rows: Row[]): SupabaseClient {
  function missionsQuery() {
    let filtered = [...rows];
    const builder = {
      select(_cols?: string) {
        return builder;
      },
      eq(col: string, val: unknown) {
        filtered = filtered.filter((r) => r[col] === val);
        return builder;
      },
      insert(row: Row) {
        const withId = { id: `mission-${rows.length + 1}`, status: "open", ...row };
        rows.push(withId);
        filtered = [withId];
        return builder;
      },
      async maybeSingle() {
        return { data: filtered[0] ?? null, error: null };
      },
    };
    return builder;
  }

  return {
    from: (table: string) => {
      if (table === "denis_missions") return missionsQuery();
      // activity log — fire-and-forget insert, accept and ignore
      return { insert: async () => ({ error: null }) };
    },
  } as unknown as SupabaseClient;
}

describe("create_mission voice tool (ADR-053 M4)", () => {
  const executorInput = {
    locationId: "loc-1",
    orgId: "org-1",
    staffId: "staff-1",
    staffRole: "kitchen",
    station: "kitchen" as const,
  };

  let rows: Row[];

  beforeEach(() => {
    rows = [];
    dispatchStaffNotification.mockClear();
  });

  it("creates an open custom mission for the target role and notifies staff", async () => {
    const admin = makeFakeAdmin(rows);
    const result = (await executeStationGeneralVoiceTool(
      "create_mission",
      { ...executorInput, admin },
      { text: "Podseti Marka da donese led", targetRole: "waiter" }
    )) as { ok: boolean; missionId?: string; delivered?: boolean };

    expect(result.ok).toBe(true);
    expect(result.missionId).toBeDefined();
    expect(dispatchStaffNotification).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "custom",
      assigned_role: "waiter",
      priority: "normal",
      status: "open",
    });
  });

  it("marks urgent missions with urgent priority and an urgent notification", async () => {
    const admin = makeFakeAdmin(rows);
    await executeStationGeneralVoiceTool(
      "create_mission",
      { ...executorInput, admin },
      { text: "Nestala je soda voda, hitno", targetRole: "bar", urgent: true }
    );

    expect(rows[0]).toMatchObject({ priority: "urgent" });
    expect(dispatchStaffNotification).toHaveBeenCalledWith(
      expect.objectContaining({ priorityOverride: "urgent" })
    );
  });

  it("rejects an empty task description without touching the database", async () => {
    const admin = makeFakeAdmin(rows);
    const result = (await executeStationGeneralVoiceTool(
      "create_mission",
      { ...executorInput, admin },
      { text: "   ", targetRole: "waiter" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_input");
    expect(rows).toHaveLength(0);
    expect(dispatchStaffNotification).not.toHaveBeenCalled();
  });

  it("rejects an invalid/missing targetRole without touching the database", async () => {
    const admin = makeFakeAdmin(rows);
    const result = (await executeStationGeneralVoiceTool(
      "create_mission",
      { ...executorInput, admin },
      { text: "Donesi led", targetRole: "owner" }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_input");
    expect(rows).toHaveLength(0);
  });
});
