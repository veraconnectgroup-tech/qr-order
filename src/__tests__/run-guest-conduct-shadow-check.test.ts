import { afterEach, describe, expect, it, vi } from "vitest";

const { appendMock, saveTrackerMock } = vi.hoisted(() => ({
  appendMock: vi.fn().mockResolvedValue(null),
  saveTrackerMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/denis/platform/append-timeline-event", () => ({
  appendDenisTimelineEvent: appendMock,
}));

vi.mock("@/lib/denis/cognition/policy/guest-conduct-tracker-store", () => ({
  loadGuestConductTracker: vi.fn().mockResolvedValue({
    aiSessionId: "session-1",
    tier: "none",
    totalOffenseCount: 0,
    respectfulStreak: 0,
    tierSince: Date.now(),
  }),
  saveGuestConductTracker: saveTrackerMock,
}));

vi.mock("@/lib/denis/config/rollout", () => ({
  isInCanaryCohort: () => true,
}));

const fakeAdmin = {} as never;
const enabledConfig = { enabled: true, shadowOnly: true, canaryPercent: 100 };

describe("runGuestConductShadowCheck", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    appendMock.mockClear();
    saveTrackerMock.mockClear();
  });

  it("trusts the LLM assessment alone when it succeeds, even if regex also flags the message", async () => {
    vi.doMock("@/lib/denis/security/abuse-protection", () => ({
      detectAbuseSignals: () => ["offensive_content"],
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-guest-conduct", () => ({
      assessGuestConduct: vi.fn().mockResolvedValue({
        toneTowardDenis: "respectful",
        directedAt: "unclear",
        confidence: 0.9,
        quotedSpan: "ok",
      }),
    }));
    const { runGuestConductShadowCheck } = await import(
      "@/lib/denis/cognition/policy/run-guest-conduct-shadow-check"
    );

    await runGuestConductShadowCheck(fakeAdmin, {
      aiSessionId: "session-1",
      message: "whatever",
      guestConductConfig: enabledConfig,
    });

    const payload = appendMock.mock.calls[0]?.[1]?.payload as Record<
      string,
      unknown
    >;
    // Regex says offensive, but LLM says respectful — LLM must win.
    expect(payload.offenseDetectedThisTurn).toBe(false);
    expect(payload.regexOnlyOffenseDetected).toBe(true);
  });

  it("falls back to regex when the LLM assessment is unavailable", async () => {
    vi.doMock("@/lib/denis/security/abuse-protection", () => ({
      detectAbuseSignals: () => ["offensive_content"],
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-guest-conduct", () => ({
      assessGuestConduct: vi.fn().mockResolvedValue(null),
    }));
    const { runGuestConductShadowCheck } = await import(
      "@/lib/denis/cognition/policy/run-guest-conduct-shadow-check"
    );

    await runGuestConductShadowCheck(fakeAdmin, {
      aiSessionId: "session-1",
      message: "whatever",
      guestConductConfig: enabledConfig,
    });

    const payload = appendMock.mock.calls[0]?.[1]?.payload as Record<
      string,
      unknown
    >;
    expect(payload.offenseDetectedThisTurn).toBe(true);
    expect(payload.llmAssessment).toBeNull();
  });

  it("does not flag when the LLM assessment succeeds but is not directed at Denis", async () => {
    vi.doMock("@/lib/denis/security/abuse-protection", () => ({
      detectAbuseSignals: () => [],
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-guest-conduct", () => ({
      assessGuestConduct: vi.fn().mockResolvedValue({
        toneTowardDenis: "severe_insult",
        directedAt: "service",
        confidence: 0.95,
        quotedSpan: "ova hrana je grozna",
      }),
    }));
    const { runGuestConductShadowCheck } = await import(
      "@/lib/denis/cognition/policy/run-guest-conduct-shadow-check"
    );

    await runGuestConductShadowCheck(fakeAdmin, {
      aiSessionId: "session-1",
      message: "ova hrana je grozna",
      guestConductConfig: enabledConfig,
    });

    const payload = appendMock.mock.calls[0]?.[1]?.payload as Record<
      string,
      unknown
    >;
    expect(payload.offenseDetectedThisTurn).toBe(false);
  });

  it("creates a real mission and notifies staff when tier reaches handoff and shadowOnly is false", async () => {
    vi.doMock("@/lib/denis/security/abuse-protection", () => ({
      detectAbuseSignals: () => ["offensive_content"],
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-guest-conduct", () => ({
      assessGuestConduct: vi.fn().mockResolvedValue({
        toneTowardDenis: "severe_insult",
        directedAt: "denis",
        confidence: 0.9,
        quotedSpan: "you are useless",
      }),
    }));
    vi.doMock("@/lib/denis/cognition/policy/guest-conduct-tracker-store", () => ({
      loadGuestConductTracker: vi.fn().mockResolvedValue({
        aiSessionId: "session-1",
        tier: "warn_2",
        totalOffenseCount: 2,
        respectfulStreak: 0,
        tierSince: Date.now(),
      }),
      saveGuestConductTracker: saveTrackerMock,
    }));
    const createMissionMock = vi.fn().mockResolvedValue({
      created: true,
      mission: { id: "mission-1" },
    });
    vi.doMock("@/lib/denis/missions/create-mission", () => ({
      createMission: createMissionMock,
    }));
    const dispatchMock = vi.fn().mockResolvedValue({ delivered: true });
    vi.doMock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
      dispatchStaffNotification: dispatchMock,
    }));
    const { runGuestConductShadowCheck } = await import(
      "@/lib/denis/cognition/policy/run-guest-conduct-shadow-check"
    );

    await runGuestConductShadowCheck(fakeAdmin, {
      aiSessionId: "session-1",
      message: "you are useless",
      guestConductConfig: { enabled: true, shadowOnly: false, canaryPercent: 100 },
      orgId: "org-1",
      locationId: "loc-1",
      tableId: "table-1",
    });

    expect(createMissionMock).toHaveBeenCalledWith(
      fakeAdmin,
      expect.objectContaining({
        kind: "guest_conduct_handoff",
        orgId: "org-1",
        locationId: "loc-1",
        aiSessionId: "session-1",
      })
    );
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "denis_escalation", tableId: "table-1" })
    );
    const payload = appendMock.mock.calls[0]?.[1]?.payload as Record<
      string,
      unknown
    >;
    expect(payload.tier).toBe("handoff");
    expect(payload.wouldCreateMission).toBe(true);
    expect(payload.missionId).toBe("mission-1");
  });

  it("only logs wouldCreateMission while shadowOnly, never calls createMission", async () => {
    vi.doMock("@/lib/denis/security/abuse-protection", () => ({
      detectAbuseSignals: () => ["offensive_content"],
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-guest-conduct", () => ({
      assessGuestConduct: vi.fn().mockResolvedValue({
        toneTowardDenis: "severe_insult",
        directedAt: "denis",
        confidence: 0.9,
        quotedSpan: "you are useless",
      }),
    }));
    vi.doMock("@/lib/denis/cognition/policy/guest-conduct-tracker-store", () => ({
      loadGuestConductTracker: vi.fn().mockResolvedValue({
        aiSessionId: "session-1",
        tier: "warn_2",
        totalOffenseCount: 2,
        respectfulStreak: 0,
        tierSince: Date.now(),
      }),
      saveGuestConductTracker: saveTrackerMock,
    }));
    const createMissionMock = vi.fn();
    vi.doMock("@/lib/denis/missions/create-mission", () => ({
      createMission: createMissionMock,
    }));
    const dispatchMock = vi.fn();
    vi.doMock("@/lib/denis/notifications/dispatch-staff-notification", () => ({
      dispatchStaffNotification: dispatchMock,
    }));
    const { runGuestConductShadowCheck } = await import(
      "@/lib/denis/cognition/policy/run-guest-conduct-shadow-check"
    );

    await runGuestConductShadowCheck(fakeAdmin, {
      aiSessionId: "session-1",
      message: "you are useless",
      guestConductConfig: enabledConfig,
      orgId: "org-1",
      locationId: "loc-1",
    });

    expect(createMissionMock).not.toHaveBeenCalled();
    expect(dispatchMock).not.toHaveBeenCalled();
    const payload = appendMock.mock.calls[0]?.[1]?.payload as Record<
      string,
      unknown
    >;
    expect(payload.tier).toBe("handoff");
    expect(payload.wouldCreateMission).toBe(true);
    expect(payload.missionId).toBeNull();
  });

  it("does nothing when guestConduct is disabled", async () => {
    vi.doMock("@/lib/denis/security/abuse-protection", () => ({
      detectAbuseSignals: () => ["offensive_content"],
    }));
    vi.doMock("@/lib/denis/cognition/perceive/assess-guest-conduct", () => ({
      assessGuestConduct: vi.fn(),
    }));
    const { runGuestConductShadowCheck } = await import(
      "@/lib/denis/cognition/policy/run-guest-conduct-shadow-check"
    );
    const { assessGuestConduct } = await import(
      "@/lib/denis/cognition/perceive/assess-guest-conduct"
    );

    await runGuestConductShadowCheck(fakeAdmin, {
      aiSessionId: "session-1",
      message: "whatever",
      guestConductConfig: { enabled: false, shadowOnly: true, canaryPercent: 100 },
    });

    expect(assessGuestConduct).not.toHaveBeenCalled();
    expect(appendMock).not.toHaveBeenCalled();
  });
});
