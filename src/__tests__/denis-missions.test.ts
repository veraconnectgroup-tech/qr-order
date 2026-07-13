import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMission } from "@/lib/denis/missions/create-mission";
import { cancelMission, completeMission } from "@/lib/denis/missions/complete-mission";

type Row = Record<string, unknown>;

function makeFakeAdmin(rows: Row[]): SupabaseClient {
  function query() {
    let filtered = [...rows];
    let pendingUpdate: Row | null = null;

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
      update(patch: Row) {
        pendingUpdate = patch;
        return builder;
      },
      async maybeSingle() {
        if (pendingUpdate) {
          filtered = filtered.map((r) => ({ ...r, ...pendingUpdate }));
          for (const updated of filtered) {
            const idx = rows.findIndex((r) => r.id === updated.id);
            if (idx >= 0) rows[idx] = updated;
          }
        }
        return { data: filtered[0] ?? null, error: null };
      },
    };
    return builder;
  }

  return { from: () => query() } as unknown as SupabaseClient;
}

describe("denis missions", () => {
  let rows: Row[];
  let admin: SupabaseClient;

  beforeEach(() => {
    rows = [];
    admin = makeFakeAdmin(rows);
  });

  it("createMission inserts an open row", async () => {
    const result = await createMission(admin, {
      kind: "guest_conduct_handoff",
      orgId: "org-1",
      locationId: "loc-1",
      aiSessionId: "session-1",
      title: "Guest conduct handoff",
      summary: "Test",
    });
    expect(result.created).toBe(true);
    if (result.created) {
      expect(result.mission.status).toBe("open");
      expect(result.mission.kind).toBe("guest_conduct_handoff");
    }
  });

  it("createMission refuses a duplicate open mission for the same session+kind", async () => {
    await createMission(admin, {
      kind: "guest_conduct_handoff",
      orgId: "org-1",
      locationId: "loc-1",
      aiSessionId: "session-1",
      title: "Guest conduct handoff",
      summary: "Test",
    });
    const second = await createMission(admin, {
      kind: "guest_conduct_handoff",
      orgId: "org-1",
      locationId: "loc-1",
      aiSessionId: "session-1",
      title: "Guest conduct handoff",
      summary: "Test",
    });
    expect(second.created).toBe(false);
    if (!second.created) expect(second.reason).toBe("already_open");
  });

  it("completeMission marks an open mission completed", async () => {
    const created = await createMission(admin, {
      kind: "kitchen_question",
      orgId: "org-1",
      locationId: "loc-1",
      title: "Kitchen question",
      summary: "Test",
    });
    if (!created.created) throw new Error("setup failed");

    const result = await completeMission(admin, {
      missionId: created.mission.id,
      staffId: "staff-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission.status).toBe("completed");
      expect(result.mission.completed_by).toBe("staff-1");
    }
  });

  it("completeMission refuses an already-completed mission", async () => {
    const created = await createMission(admin, {
      kind: "kitchen_question",
      orgId: "org-1",
      locationId: "loc-1",
      title: "Kitchen question",
      summary: "Test",
    });
    if (!created.created) throw new Error("setup failed");

    await completeMission(admin, { missionId: created.mission.id, staffId: "staff-1" });
    const second = await completeMission(admin, {
      missionId: created.mission.id,
      staffId: "staff-2",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("not_open");
  });

  it("cancelMission marks an open mission cancelled with a reason", async () => {
    const created = await createMission(admin, {
      kind: "bar_question",
      orgId: "org-1",
      locationId: "loc-1",
      title: "Bar question",
      summary: "Test",
    });
    if (!created.created) throw new Error("setup failed");

    const result = await cancelMission(admin, {
      missionId: created.mission.id,
      reason: "No longer needed.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission.status).toBe("cancelled");
      expect(result.mission.cancel_reason).toBe("No longer needed.");
    }
  });
});
