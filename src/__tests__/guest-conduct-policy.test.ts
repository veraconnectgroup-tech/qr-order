import { describe, expect, it } from "vitest";
import { stepGuestConductTier } from "@/lib/denis/cognition/policy/guest-conduct-ladder";
import { resolveGuestConductPolicy } from "@/lib/denis/cognition/policy/resolve-guest-conduct-policy";
import {
  DEFAULT_GUEST_CONDUCT_LADDER_CONFIG,
  emptyGuestConductTracker,
  type GuestConductTracker,
} from "@/lib/denis/cognition/policy/policy-decision-types";

describe("stepGuestConductTier", () => {
  it("stays at none with no offense", () => {
    expect(
      stepGuestConductTier({
        currentTier: "none",
        offenseDetectedThisTurn: false,
        respectfulStreak: 5,
        totalOffenseCount: 0,
      })
    ).toBe("none");
  });

  it("steps none -> warn_1 -> warn_2 -> handoff on consecutive offenses", () => {
    expect(
      stepGuestConductTier({
        currentTier: "none",
        offenseDetectedThisTurn: true,
        respectfulStreak: 0,
        totalOffenseCount: 1,
      })
    ).toBe("warn_1");

    expect(
      stepGuestConductTier({
        currentTier: "warn_1",
        offenseDetectedThisTurn: true,
        respectfulStreak: 0,
        totalOffenseCount: 2,
      })
    ).toBe("warn_2");

    expect(
      stepGuestConductTier({
        currentTier: "warn_2",
        offenseDetectedThisTurn: true,
        respectfulStreak: 0,
        totalOffenseCount: 3,
      })
    ).toBe("handoff");
  });

  it("never de-escalates below warn_1 in one respectful turn (asymmetric)", () => {
    expect(
      stepGuestConductTier({
        currentTier: "warn_1",
        offenseDetectedThisTurn: false,
        respectfulStreak: 1,
        totalOffenseCount: 1,
      })
    ).toBe("warn_1");
  });

  it("steps down exactly one tier after enough consecutive respectful turns", () => {
    expect(
      stepGuestConductTier({
        currentTier: "warn_2",
        offenseDetectedThisTurn: false,
        respectfulStreak: 3,
        totalOffenseCount: 2,
      })
    ).toBe("warn_1");
  });

  it("handoff is a one-way door — never auto de-escalates", () => {
    expect(
      stepGuestConductTier({
        currentTier: "handoff",
        offenseDetectedThisTurn: false,
        respectfulStreak: 100,
        totalOffenseCount: 3,
      })
    ).toBe("handoff");
  });
});

describe("resolveGuestConductPolicy", () => {
  function tracker(overrides: Partial<GuestConductTracker> = {}): GuestConductTracker {
    return { ...emptyGuestConductTracker("session-1"), ...overrides };
  }

  it("no offense, no decision", () => {
    const { decision, tracker: next } = resolveGuestConductPolicy({
      offenseDetectedThisTurn: false,
      tracker: tracker(),
    });
    expect(decision.tier).toBe("none");
    expect(decision.guestMessageOverride).toBeNull();
    expect(decision.haltSensitiveActions).toBe(false);
    expect(next.totalOffenseCount).toBe(0);
  });

  it("first offense -> warn_1 with a scripted line, no halt", () => {
    const { decision, tracker: next } = resolveGuestConductPolicy({
      offenseDetectedThisTurn: true,
      tracker: tracker(),
    });
    expect(decision.tier).toBe("warn_1");
    expect(decision.guestMessageOverride).toBeTruthy();
    expect(decision.haltSensitiveActions).toBe(false);
    expect(decision.notifyStaff).toBe(false);
    expect(next.totalOffenseCount).toBe(1);
    expect(next.respectfulStreak).toBe(0);
  });

  it("third offense -> handoff, halts sensitive actions, notifies staff", () => {
    let state = tracker();
    let result = resolveGuestConductPolicy({ offenseDetectedThisTurn: true, tracker: state });
    state = result.tracker;
    result = resolveGuestConductPolicy({ offenseDetectedThisTurn: true, tracker: state });
    state = result.tracker;
    result = resolveGuestConductPolicy({ offenseDetectedThisTurn: true, tracker: state });

    expect(result.decision.tier).toBe("handoff");
    expect(result.decision.haltSensitiveActions).toBe(true);
    expect(result.decision.notifyStaff).toBe(true);
    expect(result.decision.guestMessageOverride).toBeTruthy();
  });

  it("does not repeat the warning line on a calm turn at the same tier", () => {
    const afterOffense = resolveGuestConductPolicy({
      offenseDetectedThisTurn: true,
      tracker: tracker(),
    });
    const calmTurn = resolveGuestConductPolicy({
      offenseDetectedThisTurn: false,
      tracker: afterOffense.tracker,
    });
    expect(calmTurn.decision.tier).toBe("warn_1");
    expect(calmTurn.decision.guestMessageOverride).toBeNull();
  });

  it("respects a custom config threshold", () => {
    const config = {
      ...DEFAULT_GUEST_CONDUCT_LADDER_CONFIG,
      handoffAfterInsults: 2,
    };
    let state = tracker();
    let result = resolveGuestConductPolicy({
      offenseDetectedThisTurn: true,
      tracker: state,
      config,
    });
    state = result.tracker;
    result = resolveGuestConductPolicy({
      offenseDetectedThisTurn: true,
      tracker: state,
      config,
    });
    expect(result.decision.tier).toBe("handoff");
  });
});
