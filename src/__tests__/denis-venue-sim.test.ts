import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { extractTimelineReplayTurns } from "@/lib/denis/eval/extract-timeline-turns";
import { runVenueSim } from "@/lib/denis/eval/run-venue-sim";
import { applyVenueSimOverrides } from "@/lib/denis/eval/apply-venue-sim-overrides";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function row(
  seq: number,
  event_type: DenisTimelineRow["event_type"],
  payload: DenisTimelineRow["payload"],
  trace_id = "trace-a"
): DenisTimelineRow {
  return {
    id: `id-${seq}`,
    ai_session_id: "session-1",
    seq,
    event_type,
    payload,
    trace_id,
    context_hash: null,
    created_at: "2026-05-27T12:00:00.000Z",
  };
}

describe("Denis M20 venue sim", () => {
  it("extracts ordered replay turns from timeline", () => {
    const turns = extractTimelineReplayTurns([
      row(1, "perception.ingested", {
        frame: { normalizedText: "dva piva", channel: "chat.message" },
      }),
      row(2, "flow.transitioned", { from: "welcome", to: "collect" }),
      row(3, "perception.ingested", {
        frame: { normalizedText: "da", channel: "ui.quick_reply" },
      }, "trace-b"),
      row(4, "flow.transitioned", { from: "collect", to: "recap" }, "trace-b"),
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0]?.guestText).toBe("dva piva");
    expect(turns[1]?.flowNodeId).toBe("collect");
  });

  it("applies counterfactual overrides with simulation rollout", () => {
    const cf = applyVenueSimOverrides(CONCIERGE_PLATFORM_DEFAULTS, {
      foodAfterDrinks: false,
      rushSkipUpsell: true,
    });
    expect(cf.upsell.foodAfterDrinks).toBe(false);
    expect(cf.ops.rushSkipUpsell).toBe(true);
    expect(cf.rollout.mode).toBe("simulation");
  });

  it("runs dual planner replay and reports metric delta", () => {
    const events = [
      row(1, "perception.ingested", {
        frame: { normalizedText: "cola", channel: "chat.message" },
      }),
      row(2, "flow.transitioned", { from: "welcome", to: "collect" }),
    ];

    const report = runVenueSim("session-1", events, CONCIERGE_PLATFORM_DEFAULTS, {
      rushSkipUpsell: true,
      foodAfterDrinks: false,
    });

    expect(report.turns.length).toBeGreaterThan(0);
    expect(report.metrics.baseline.turnCount).toBe(1);
    expect(report.metrics.counterfactual.turnCount).toBe(1);
    expect(report.counterfactualLabel).toContain("rushSkipUpsell=true");
  });
});
