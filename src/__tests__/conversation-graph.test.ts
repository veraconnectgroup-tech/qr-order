import { describe, expect, it } from "vitest";
import {
  buildActiveMemory,
  formatActiveMemoryBlock,
} from "@/lib/denis/cognition/conversation/active-memory";
import { CONVERSATION_TOPIC_IDS } from "@/lib/denis/cognition/conversation/conversation-graph";
import { foldConversationModel } from "@/lib/denis/cognition/conversation/fold-conversation-model";
import {
  foldConversationGraph,
  formatConversationGraphBlock,
  resolveGuestReference,
  buildTopicInterpretationDirective,
} from "@/lib/denis/cognition/conversation/topic-tracker";
import { buildInterpretationTask } from "@/lib/denis/cognition/tde/build-interpretation-task";
import {
  belief,
  beliefGraph,
  CORE_BELIEF_KEYS,
} from "@/lib/denis/cognition/beliefs/belief-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function guestRow(seq: number, text: string, at: string): DenisTimelineRow {
  return {
    id: `guest-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "perception.ingested",
    payload: {
      type: "perception.ingested",
      frame: {
        channel: "chat.message",
        normalizedText: text,
        structuredIntent: null,
        ingestedAt: at,
      },
      envelope: { traceId: "t1", surface: "chat" },
    },
    trace_id: null,
    context_hash: null,
    created_at: at,
  };
}

function denisRow(seq: number, text: string, at: string): DenisTimelineRow {
  return {
    id: `denis-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "tell.committed",
    payload: { type: "tell.committed", message: text, tier: "template" },
    trace_id: null,
    context_hash: null,
    created_at: at,
  };
}

describe("conversation graph (Prompt 93)", () => {
  const burgerThread = [
    { role: "guest" as const, text: "Burger bez luka" },
    { role: "denis" as const, text: "Jedan burger bez luka — 12€" },
    { role: "guest" as const, text: "medium rare" },
    { role: "denis" as const, text: "Upisao sam medium rare." },
  ];

  it("tracks burger topic children and price follow-up", () => {
    const graph = foldConversationGraph(burgerThread);
    const burger = graph.topics.find((topic) => topic.id === "burger");
    expect(burger?.children).toEqual(
      expect.arrayContaining(["bez luka", "medium rare"])
    );
    expect(graph.activeTopicId).toBe("burger");

    const price = resolveGuestReference(graph, "a koliko kosta?");
    expect(price.kind).toBe("active_topic_price");
    expect(price.topicId).toBe("burger");
    expect(price.detail).toContain("12€");
  });

  it("switches active topic to drinks", () => {
    const graph = foldConversationGraph([
      ...burgerThread,
      { role: "guest", text: "a ono pivo?" },
    ]);
    expect(graph.activeTopicId).toBe(CONVERSATION_TOPIC_IDS.drinks);
    const resolution = resolveGuestReference(graph, "a ono pivo?");
    expect(resolution.kind).toBe("topic_switch");
  });

  it("clones last order for friend", () => {
    const graph = foldConversationGraph([
      { role: "guest", text: "1x burger bez luka" },
      { role: "denis", text: "Dodao sam burger." },
      { role: "guest", text: "i za drugara isto" },
    ]);
    const resolution = resolveGuestReference(graph, "i za drugara isto");
    expect(resolution.kind).toBe("clone_for_friend");
    expect(resolution.detail).toContain("burger");
  });

  it("marks completed topics and suggests next", () => {
    const graph = foldConversationGraph([
      { role: "guest", text: "Burger bez luka" },
      { role: "denis", text: "Recap: burger bez luka?" },
      { role: "guest", text: "Da" },
      { role: "guest", text: "Pilsner molim" },
    ]);
    const burger = graph.topics.find((topic) => topic.id === "burger");
    expect(burger?.status).toBe("ordered");
    const block = formatConversationGraphBlock(graph);
    expect(block).toContain("Piće");
  });

  it("prioritizes active topic + allergies in active memory block", () => {
    const timeline: DenisTimelineRow[] = [];
    let seq = 1;
    const script = [
      ...burgerThread,
      { role: "guest" as const, text: "Imam alergiju na gluten" },
      { role: "denis" as const, text: "Bez glutena — razumem." },
      { role: "guest" as const, text: "Pilsner" },
      { role: "denis" as const, text: "0.5L pilsner?" },
    ];
    for (const row of script) {
      timeline.push(
        row.role === "guest"
          ? guestRow(seq++, row.text, `2026-06-07T12:0${seq}:00.000Z`)
          : denisRow(seq++, row.text, `2026-06-07T12:0${seq}:00.000Z`)
      );
    }
    for (let i = 12; i <= 28; i++) {
      timeline.push(
        guestRow(seq++, `filler ${i}`, `2026-06-07T12:${String(i).padStart(2, "0")}:00.000Z`)
      );
      timeline.push(
        denisRow(seq++, `ok ${i}`, `2026-06-07T12:${String(i).padStart(2, "0")}:01.000Z`)
      );
    }

    const model = foldConversationModel({
      timeline,
      flowNodeId: "collect",
      pendingSlot: null,
      commerceConfirm: false,
    });
    const memory = buildActiveMemory(timeline, 500, Date.now(), model.graph);
    expect(memory).not.toBeNull();
    const block = formatActiveMemoryBlock(memory!);
    expect(block).toContain("CONVERSATION GRAPH");
    expect(block).toContain("alergije");
  });

  it("adds topic directive to interpretation task", () => {
    const graph = foldConversationGraph(burgerThread);
    const beliefs = beliefGraph([
      belief(CORE_BELIEF_KEYS.commercePressure, "open", "inferred", 0.9),
      belief(CORE_BELIEF_KEYS.conversationMode, "ordering", "inferred", 0.9),
    ]);
    const task = buildInterpretationTask(
      { type: "COMPLETE_ROUND", priority: 90 },
      beliefs,
      { guestMessage: "a koliko kosta?", conversationGraph: graph }
    );
    expect(task?.directiveBlock).toContain("CONVERSATION GRAPH");
    expect(task?.directiveBlock).toContain("active_topic_price");
  });

  it("buildTopicInterpretationDirective resolves first mention", () => {
    const graph = foldConversationGraph([
      { role: "guest", text: "Pilsner i Weizen?" },
      { role: "denis", text: "Imamo oba." },
      { role: "guest", text: "Prvo" },
    ]);
    const directive = buildTopicInterpretationDirective({
      graph,
      guestMessage: "Prvo",
    });
    expect(directive).toContain("first_mentioned");
  });
});
