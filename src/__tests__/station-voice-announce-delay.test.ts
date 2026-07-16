import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveVenueOpsEvidence } from "@/lib/denis/cognition/context/retrievers/venue-ops-evidence";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const { redisStore, redisState } = vi.hoisted(() => ({
  redisStore: new Map<string, unknown>(),
  redisState: { available: true },
}));

vi.mock("@/lib/redis/client", () => ({
  getRedisClient: () =>
    redisState.available
      ? {
          get: async (key: string) => redisStore.get(key) ?? null,
          set: async (key: string, value: unknown) => {
            redisStore.set(key, value);
          },
          del: async (key: string) => {
            redisStore.delete(key);
          },
        }
      : null,
  logRedisDegradation: vi.fn(),
}));

const dispatchStaffNotification = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ delivered: true })
);
vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification,
}));

import { executeStationGeneralVoiceTool } from "@/lib/denis/agentic/station-general-voice-tool-catalog";
import {
  getVenueDelayNote,
  setVenueDelayNote,
} from "@/lib/denis/venue/ops/venue-delay-note";

const executorInput = {
  admin: {
    from: () => ({ insert: async () => ({ error: null }) }),
  } as unknown as SupabaseClient,
  locationId: "loc-1",
  orgId: "org-1",
  staffId: "staff-1",
  staffRole: "kitchen",
  station: "kitchen" as const,
};

describe("venue delay note store", () => {
  beforeEach(() => {
    redisStore.clear();
    redisState.available = true;
  });

  it("round-trips a note and reports failure without Redis", async () => {
    expect(await setVenueDelayNote("loc-1", { area: "roštilj", minutes: 10 })).toBe(true);
    const note = await getVenueDelayNote("loc-1");
    expect(note).toMatchObject({ area: "roštilj", minutes: 10 });

    redisState.available = false;
    expect(await setVenueDelayNote("loc-1", { area: "x", minutes: 5 })).toBe(false);
    expect(await getVenueDelayNote("loc-1")).toBeNull();
  });
});

describe("announce delay voice pair (ADR-053 M2)", () => {
  beforeEach(() => {
    redisStore.clear();
    redisState.available = true;
    dispatchStaffNotification.mockClear();
  });

  it("confirm without a prior propose is rejected", async () => {
    const result = (await executeStationGeneralVoiceTool(
      "confirm_delay",
      executorInput
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_pending_proposal");
    expect(await getVenueDelayNote("loc-1")).toBeNull();
  });

  it("propose then confirm publishes the note, notifies staff, and is single-shot", async () => {
    const proposed = (await executeStationGeneralVoiceTool(
      "propose_delay",
      executorInput,
      { area: "roštilj", minutes: 10 }
    )) as { ok: boolean; sayToStaff?: string };

    expect(proposed.ok).toBe(true);
    expect(proposed.sayToStaff).toContain("Potvrdi");
    expect(await getVenueDelayNote("loc-1")).toBeNull();

    const confirmed = (await executeStationGeneralVoiceTool(
      "confirm_delay",
      executorInput
    )) as { ok: boolean; area?: string; minutes?: number };

    expect(confirmed.ok).toBe(true);
    expect(confirmed.area).toBe("roštilj");
    expect(await getVenueDelayNote("loc-1")).toMatchObject({
      area: "roštilj",
      minutes: 10,
    });
    expect(dispatchStaffNotification).toHaveBeenCalledTimes(1);

    const replay = (await executeStationGeneralVoiceTool(
      "confirm_delay",
      executorInput
    )) as { ok: boolean; error?: string };
    expect(replay.ok).toBe(false);
    expect(replay.error).toBe("no_pending_proposal");
  });

  it("rejects out-of-range minutes before proposing anything", async () => {
    const result = (await executeStationGeneralVoiceTool(
      "propose_delay",
      executorInput,
      { area: "roštilj", minutes: 500 }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_input");
  });

  it("fails closed without Redis — no unconfirmed announcement path", async () => {
    redisState.available = false;
    const result = (await executeStationGeneralVoiceTool(
      "propose_delay",
      executorInput,
      { area: "roštilj", minutes: 10 }
    )) as { ok: boolean; error?: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("confirmation_unavailable");
  });
});

describe("venue ops evidence — delay note line", () => {
  const baseOps: VenueOpsBeliefs = {
    operatingMode: "normal",
    kdsStress: "normal",
    acceptingOrders: true,
    unavailableProductIds: [],
    staffHint: null,
    eventConfig: null,
  } as VenueOpsBeliefs;

  it("includes the announced delay with honest-timeline guidance", () => {
    const block = retrieveVenueOpsEvidence(
      { ...baseOps, delayNote: { area: "roštilj", minutes: 10 } },
      null
    );
    expect(block).toContain("Announced delay: roštilj is running ~10 min behind");
    expect(block).toContain("real timeline");
  });

  it("emits no delay line when there is no note", () => {
    const block = retrieveVenueOpsEvidence(baseOps, null);
    expect(block).not.toContain("Announced delay");
  });
});
