import { describe, expect, it } from "vitest";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  buildActiveMemory,
  formatActiveMemoryBlock,
} from "@/lib/denis/cognition/conversation/active-memory";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { foldConversationModel } from "@/lib/denis/cognition/conversation/fold-conversation-model";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

function tellRow(seq: number, message: string): DenisTimelineRow {
  return {
    id: `tell-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "tell.committed",
    payload: { type: "tell.committed", message, tier: "template" },
    trace_id: null,
    context_hash: null,
    created_at: new Date(Date.now() + seq * 1000).toISOString(),
  };
}

function guestRow(seq: number, text: string): DenisTimelineRow {
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
        ingestedAt: new Date().toISOString(),
      },
      envelope: { traceId: "t1", surface: "chat" },
    },
    trace_id: null,
    context_hash: null,
    created_at: new Date(Date.now() + seq * 1000).toISOString(),
  };
}

function buildLongTimeline(): DenisTimelineRow[] {
  const script: Array<{ role: "guest" | "denis"; text: string }> = [
    { role: "guest", text: "Dobar dan" },
    { role: "denis", text: "Dobar dan! Kako mogu pomoći?" },
    { role: "guest", text: "Burger bez luka molim" },
    { role: "denis", text: "Odlično — jedan burger bez luka. Još nešto?" },
    { role: "guest", text: "Imate veganske opcije?" },
    { role: "denis", text: "Imamo salatu i wrap — šta vam odgovara?" },
    { role: "guest", text: "Hmm, možda kasnije" },
    { role: "denis", text: "Naravno, javite kad budete spremni." },
    { role: "guest", text: "Daj mi i pivo" },
    { role: "denis", text: "Koju veličinu piva — 0.3L ili 0.5L?" },
    { role: "guest", text: "0.5" },
    { role: "denis", text: "Dodao sam 0.5L pivo. Još nešto?" },
    { role: "guest", text: "Ne, hvala" },
    { role: "denis", text: "Super — da potvrdim: burger bez luka i pivo 0.5L?" },
    { role: "guest", text: "Da" },
    { role: "denis", text: "Potvrđeno! Šaljem u kuhinju." },
    { role: "guest", text: "Koliko traje?" },
    { role: "denis", text: "Oko 15 minuta za burger." },
    { role: "guest", text: "Ok hvala" },
    { role: "denis", text: "Nema na čemu!" },
    { role: "guest", text: "A desert?" },
    { role: "denis", text: "Imamo tortu i palačinke — šta želite?" },
    { role: "guest", text: "Možda tortu" },
    { role: "denis", text: "Koja torta — čokoladna ili voćna?" },
    { role: "guest", text: "Voćna" },
    { role: "denis", text: "Dodao sam voćnu tortu. Još nešto?" },
  ];

  return script.map((entry, index) =>
    entry.role === "guest"
      ? guestRow(index + 1, entry.text)
      : tellRow(index + 1, entry.text)
  );
}

describe("active memory (U1)", () => {
  it("returns null for short conversations (≤10 messages)", () => {
    const timeline = [
      guestRow(1, "pivo"),
      tellRow(2, "Koju veličinu?"),
      guestRow(3, "0.5"),
    ];

    expect(buildActiveMemory(timeline)).toBeNull();
  });

  it("preserves bez luka preference from early message in 25-turn session", () => {
    const timeline = buildLongTimeline();
    expect(timeline.length).toBeGreaterThanOrEqual(25);

    const memory = buildActiveMemory(timeline);
    expect(memory).not.toBeNull();
    expect(memory!.guestPreferences.some((p) => /bez luka/i.test(p))).toBe(true);
    expect(memory!.keyFacts.length).toBeGreaterThan(0);
    expect(memory!.semanticSummary.length).toBeGreaterThan(0);
    expect(memory!.tokensSaved).toBeGreaterThan(0);
    expect(memory!.rawTail.length).toBe(5);
  });

  it("surfaces open question when guest asks at end without reply", () => {
    const timeline = [
      ...buildLongTimeline(),
      guestRow(27, "Imate li bezglutenske opcije?"),
    ];
    const memory = buildActiveMemory(timeline);

    expect(memory).not.toBeNull();
    const block = formatActiveMemoryBlock(memory!);
    expect(block).toContain("AKTIVNO PAMĆENJE");
    expect(memory!.openQuestions.some((q) => /bezgluten/i.test(q))).toBe(true);
  });

  it("injects active memory block into Situation Pack for long sessions", () => {
    const timeline = buildLongTimeline();
    const model = foldConversationModel({
      timeline,
      flowNodeId: "collect",
      pendingSlot: null,
      commerceConfirm: false,
    });

    const state: TableSessionState = {
      table: { id: "t1", name: "Table 8", token: "tok" },
      session: {
        id: "s1",
        status: "active",
        accessState: null,
        billSettled: false,
        feedbackSubmitted: false,
        denisEnabled: true,
        denisActive: true,
      },
      commerce: {
        orders: [],
        cart: { ai: emptyCartState(), visibleLines: [] },
      },
      venue: {
        ops: {
          operatingMode: "normal",
          kdsStress: "normal",
          acceptingOrders: true,
          unavailableProductIds: [],
          staffHint: null,
          stationStress: [],
        },
        opsEffects: {
          skipUpsell: false,
          shortenReplies: false,
          empathyNote: null,
          guestSafeStaffHint: null,
        },
      },
      conversation: {
        flowNodeId: "collect",
        foodUpsellAsked: false,
        dismissedNudges: [],
        lastAssistantMessage: null,
        pendingSlot: null,
        model,
        obligation: null,
      },
      timeline,
      browse: emptyBrowseProfile(),
      mental: emptyGuestMentalModel(),
      offer: emptyGuestOfferContext(),
      config: CONCIERGE_PLATFORM_DEFAULTS,
    };

    const pack = buildSituationPack({
      state,
      beliefs: beliefGraph([]),
      sessionPhase: "ordering",
    });

    expect(pack).toContain("AKTIVNO PAMĆENJE");
    expect(pack).toContain("bez luka");
    expect(pack).toContain("Kompresija");
    expect(pack).toContain("tokens_saved_vs_raw");
    expect(pack).toContain("RECENT TRANSCRIPT");
  });
});
