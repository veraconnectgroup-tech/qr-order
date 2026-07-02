import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  mergeOrderTimelineEvents,
  type OrderTimelineOrderInput,
} from "@/lib/orders/order-timeline";
import { useLazyOrderTimeline } from "@/components/dashboard/order-timeline-panel";

const BASE_ORDER: OrderTimelineOrderInput = {
  created_at: "2026-07-01T18:00:00.000Z",
  accepted_at: "2026-07-01T18:01:00.000Z",
  preparing_at: "2026-07-01T18:05:00.000Z",
  ready_at: null,
  delivered_at: null,
};

describe("mergeOrderTimelineEvents", () => {
  it("sorts merged events chronologically", () => {
    const timeline = mergeOrderTimelineEvents({
      order: BASE_ORDER,
      orderEvents: [
        {
          event_type: "order.created",
          created_at: "2026-07-01T18:00:01.000Z",
          actor_type: "system",
        },
      ],
      stationStates: [
        {
          station: "bar",
          queued_at: "2026-07-01T18:00:10.000Z",
          in_prep_at: "2026-07-01T18:02:00.000Z",
          ready_at: "2026-07-01T18:04:00.000Z",
          picked_up_at: null,
          served_at: null,
        },
      ],
      stationQuestions: [
        {
          station: "kitchen",
          question_type: "eta",
          message: "Guest waiting — when ready?",
          status: "answered",
          answer: "eta",
          answer_eta_minutes: 8,
          asked_by: "denis",
          asked_at: "2026-07-01T18:06:00.000Z",
          answered_at: "2026-07-01T18:07:00.000Z",
          expires_at: "2026-07-01T18:08:00.000Z",
        },
      ],
    });

    expect(timeline.length).toBeGreaterThan(3);
    for (let i = 1; i < timeline.length; i += 1) {
      expect(Date.parse(timeline[i]!.at)).toBeGreaterThanOrEqual(
        Date.parse(timeline[i - 1]!.at)
      );
    }

    const denisEvents = timeline.filter((entry) => entry.denis);
    expect(denisEvents.length).toBe(2);
    expect(denisEvents[0]?.kind).toBe("denis.question.asked");
    expect(denisEvents[1]?.detail).toContain("8 min");
  });

  it("returns order milestones only when station rows and questions are empty", () => {
    const timeline = mergeOrderTimelineEvents({
      order: BASE_ORDER,
      orderEvents: [],
      stationStates: [],
      stationQuestions: [],
    });

    expect(timeline.some((entry) => entry.kind === "order.created")).toBe(true);
    expect(timeline.some((entry) => entry.kind === "order.accepted")).toBe(true);
    expect(timeline.some((entry) => entry.denis)).toBe(false);
    expect(timeline.length).toBe(3);
  });

  it("marks expired station questions as Denis events", () => {
    const timeline = mergeOrderTimelineEvents({
      order: {
        ...BASE_ORDER,
        accepted_at: null,
        preparing_at: null,
      },
      orderEvents: [],
      stationStates: [],
      stationQuestions: [
        {
          station: "kitchen",
          question_type: "eta",
          message: "No answer in time",
          status: "expired",
          answer: null,
          answer_eta_minutes: null,
          asked_by: "denis",
          asked_at: "2026-07-01T18:10:00.000Z",
          answered_at: null,
          expires_at: "2026-07-01T18:12:00.000Z",
        },
      ],
    });

    expect(
      timeline.some((entry) => entry.kind === "denis.question.expired")
    ).toBe(true);
  });
});

describe("useLazyOrderTimeline", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            timeline: [
              {
                at: "2026-07-01T18:00:00.000Z",
                kind: "order.created",
                label: "Order created",
              },
            ],
          },
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch until load() is called", async () => {
    const { result } = renderHook(() =>
      useLazyOrderTimeline("11111111-1111-4111-8111-111111111111")
    );

    expect(result.current.loaded).toBe(false);
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.load();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.loaded).toBe(true);
    expect(result.current.entries).toHaveLength(1);
  });
});
