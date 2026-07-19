import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAndCreateDueCommitmentMissions } from "@/lib/denis/stations/denis-commitments";

/**
 * Fake admin client covering exactly the three tables
 * checkAndCreateDueCommitmentMissions touches: denis_commitments (read),
 * locations (read, org_id lookup), denis_missions (read for the
 * idempotency guard, insert for creation).
 */
function makeFakeAdmin(seed: {
  commitments?: Array<Record<string, unknown>>;
  locations?: Array<{ id: string; org_id: string }>;
  missions?: Array<Record<string, unknown>>;
}) {
  const commitments = seed.commitments ?? [];
  const locations = seed.locations ?? [];
  const missions = seed.missions ?? [];
  let missionCounter = 0;

  function from(table: string) {
    if (table === "denis_commitments") return commitmentsBuilder();
    if (table === "locations") return locationsBuilder();
    if (table === "denis_missions") return missionsBuilder();
    throw new Error(`fake admin: unexpected table ${table}`);
  }

  function commitmentsBuilder() {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const api = {
      select: () => api,
      eq(field: string, value: unknown) {
        filters.push((r) => r[field] === value);
        return api;
      },
      lte(field: string, value: string) {
        filters.push((r) => (r[field] as string) <= value);
        return api;
      },
      order: () => api,
      then(resolve: (v: { data: unknown[]; error: null }) => void) {
        resolve({
          data: commitments.filter((r) => filters.every((f) => f(r))),
          error: null,
        });
      },
    };
    return api;
  }

  function locationsBuilder() {
    const filters: Array<(r: { id: string; org_id: string }) => boolean> = [];
    const api = {
      select: () => api,
      eq(field: string, value: unknown) {
        filters.push((r) => (r as Record<string, unknown>)[field] === value);
        return api;
      },
      async maybeSingle() {
        const found = locations.find((r) => filters.every((f) => f(r)));
        return { data: found ?? null, error: null };
      },
    };
    return api;
  }

  function missionsBuilder() {
    type Mode = "select" | "insert" | null;
    let mode: Mode = null;
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let insertPayload: Record<string, unknown> | null = null;

    const api = {
      select(_cols?: string) {
        if (mode === null) mode = "select";
        return api;
      },
      insert(payload: Record<string, unknown>) {
        mode = "insert";
        insertPayload = payload;
        return api;
      },
      eq(field: string, value: unknown) {
        filters.push((r) => r[field] === value);
        return api;
      },
      contains(field: string, value: Record<string, unknown>) {
        filters.push((r) => {
          const target = r[field] as Record<string, unknown> | undefined;
          if (!target) return false;
          return Object.entries(value).every(([k, v]) => target[k] === v);
        });
        return api;
      },
      limit: () => api,
      async maybeSingle() {
        if (mode === "insert" && insertPayload) {
          const row = {
            id: `mission-${++missionCounter}`,
            status: "open",
            ...insertPayload,
          };
          missions.push(row);
          return { data: row, error: null };
        }
        const found = missions.find((r) => filters.every((f) => f(r)));
        return { data: found ?? null, error: null };
      },
    };
    return api;
  }

  return { admin: { from } as unknown as SupabaseClient, missions, commitments };
}

const LOCATION_ID = "loc-1";
const ORG_ID = "org-1";

describe("checkAndCreateDueCommitmentMissions — Denis follows up on his own promises", () => {
  it("creates a custom mission for a due, open commitment with no existing mission", async () => {
    const { admin, missions } = makeFakeAdmin({
      commitments: [
        {
          id: "commit-1",
          location_id: LOCATION_ID,
          text: "Javiću sutra za rezervu za 8 osoba.",
          due_date: "2026-07-19",
          status: "open",
          station: null,
          promised_to_staff_id: "staff-1",
        },
      ],
      locations: [{ id: LOCATION_ID, org_id: ORG_ID }],
    });

    const result = await checkAndCreateDueCommitmentMissions(admin, {
      today: "2026-07-19",
    });

    expect(result).toEqual({ checked: 1, created: 1 });
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({
      kind: "custom",
      org_id: ORG_ID,
      location_id: LOCATION_ID,
      assigned_staff_id: "staff-1",
      status: "open",
    });
    expect((missions[0].payload as Record<string, unknown>).commitmentId).toBe(
      "commit-1"
    );
  });

  it("skips a commitment that already has an open mission — idempotent per tick", async () => {
    const { admin, missions } = makeFakeAdmin({
      commitments: [
        {
          id: "commit-1",
          location_id: LOCATION_ID,
          text: "Provera dobavljača.",
          due_date: "2026-07-18",
          status: "open",
          station: "kitchen",
          promised_to_staff_id: null,
        },
      ],
      locations: [{ id: LOCATION_ID, org_id: ORG_ID }],
      missions: [
        {
          id: "existing-mission",
          status: "open",
          kind: "custom",
          payload: { commitmentId: "commit-1" },
        },
      ],
    });

    const result = await checkAndCreateDueCommitmentMissions(admin, {
      today: "2026-07-19",
    });

    expect(result).toEqual({ checked: 1, created: 0 });
    expect(missions).toHaveLength(1);
  });

  it("maps kitchen/bar station to assignedRole, otherwise leaves it null", async () => {
    const { admin, missions } = makeFakeAdmin({
      commitments: [
        {
          id: "commit-bar",
          location_id: LOCATION_ID,
          text: "Provera zaliha vina.",
          due_date: "2026-07-19",
          status: "open",
          station: "bar",
          promised_to_staff_id: null,
        },
      ],
      locations: [{ id: LOCATION_ID, org_id: ORG_ID }],
    });

    await checkAndCreateDueCommitmentMissions(admin, { today: "2026-07-19" });

    expect(missions[0]).toMatchObject({ assigned_role: "bar" });
  });

  it("returns checked: 0, created: 0 when nothing is due", async () => {
    const { admin } = makeFakeAdmin({
      commitments: [
        {
          id: "commit-future",
          location_id: LOCATION_ID,
          text: "Nešto za sledeću nedelju.",
          due_date: "2026-07-30",
          status: "open",
          station: null,
          promised_to_staff_id: null,
        },
      ],
      locations: [{ id: LOCATION_ID, org_id: ORG_ID }],
    });

    const result = await checkAndCreateDueCommitmentMissions(admin, {
      today: "2026-07-19",
    });

    expect(result).toEqual({ checked: 0, created: 0 });
  });
});
