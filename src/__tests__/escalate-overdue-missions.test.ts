import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
  dispatchStaffNotification: vi.fn().mockResolvedValue({ delivered: true }),
}));

import {
  escalateAllOverdueMissions,
  escalateOverdueMissionsForLocation,
} from "@/lib/denis/missions/escalate-overdue-missions";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";

function makeMissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "mission-1",
    org_id: "org-1",
    location_id: "loc-1",
    kind: "kitchen_question",
    status: "open",
    assigned_staff_id: null,
    assigned_role: null,
    table_id: "table-1",
    ai_session_id: null,
    title: "Kitchen question",
    summary: "Test",
    payload: {},
    priority: "normal",
    sla_minutes: 10,
    reminder_sent_at: null,
    escalated_at: null,
    completed_at: null,
    completed_by: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: new Date(Date.now() - 25 * 60_000).toISOString(),
    ...overrides,
  };
}

describe("escalateOverdueMissionsForLocation", () => {
  it("sends a reminder once SLA is exceeded and marks reminder_sent_at", async () => {
    const row = makeMissionRow({
      created_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    });
    const not = vi.fn().mockResolvedValue({ data: [row], error: null });
    const eq2 = vi.fn(() => ({ not }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const admin = { from: () => ({ select, update }) } as unknown as SupabaseClient;

    const result = await escalateOverdueMissionsForLocation(admin, {
      locationId: "loc-1",
    });

    expect(result).toEqual({ reminders: 1, escalations: 0 });
    expect(dispatchStaffNotification).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc-1", type: "denis_escalation" })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_sent_at: expect.any(String) })
    );
  });

  it("sends an urgent escalation once double the SLA has passed and reminder already sent", async () => {
    const row = makeMissionRow({
      created_at: new Date(Date.now() - 25 * 60_000).toISOString(),
      reminder_sent_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    });
    const not = vi.fn().mockResolvedValue({ data: [row], error: null });
    const eq2 = vi.fn(() => ({ not }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const admin = { from: () => ({ select, update }) } as unknown as SupabaseClient;

    const result = await escalateOverdueMissionsForLocation(admin, {
      locationId: "loc-1",
    });

    expect(result).toEqual({ reminders: 0, escalations: 1 });
    expect(dispatchStaffNotification).toHaveBeenCalledWith(
      expect.objectContaining({ priorityOverride: "urgent" })
    );
  });

  it("does nothing when no open missions have an SLA set", async () => {
    const not = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq2 = vi.fn(() => ({ not }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const result = await escalateOverdueMissionsForLocation(admin, {
      locationId: "loc-1",
    });
    expect(result).toEqual({ reminders: 0, escalations: 0 });
  });

  it("does not re-notify before the SLA window has passed", async () => {
    const row = makeMissionRow({
      created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    });
    const not = vi.fn().mockResolvedValue({ data: [row], error: null });
    const eq2 = vi.fn(() => ({ not }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const admin = { from: () => ({ select }) } as unknown as SupabaseClient;

    const result = await escalateOverdueMissionsForLocation(admin, {
      locationId: "loc-1",
    });
    expect(result).toEqual({ reminders: 0, escalations: 0 });
  });
});

describe("escalateAllOverdueMissions", () => {
  it("fans out across every location with open, SLA-bound missions", async () => {
    const locationSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        not: vi.fn().mockResolvedValue({
          data: [{ location_id: "loc-1" }, { location_id: "loc-2" }],
          error: null,
        }),
      })),
    }));
    const missionNot = vi.fn().mockResolvedValue({ data: [], error: null });
    const missionEq2 = vi.fn(() => ({ not: missionNot }));
    const missionEq1 = vi.fn(() => ({ eq: missionEq2 }));
    let callCount = 0;
    const admin = {
      from: () => {
        callCount += 1;
        if (callCount === 1) return { select: locationSelect };
        return { select: vi.fn(() => ({ eq: missionEq1 })) };
      },
    } as unknown as SupabaseClient;

    const result = await escalateAllOverdueMissions(admin);
    expect(result).toEqual({ reminders: 0, escalations: 0 });
  });
});
