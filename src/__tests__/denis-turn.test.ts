import { describe, expect, it } from "vitest";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import {
  aiOrderDraftToDenisCartState,
  manualSnapshotToDenisDraft,
} from "@/lib/denis/runtime/adapters/map-legacy-draft";
import {
  mapLegacyIntentToGuest,
  resolveTurnIntent,
} from "@/lib/denis/runtime/map-legacy-intent";
import { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";

describe("M7 legacy adapters", () => {
  it("maps ai order draft to Denis cart state", () => {
    const draft = initDraftFromStorage({
      version: 1,
      items: [
        {
          productId: "p1",
          productName: "Espresso",
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
          lineTotal: 3.5,
          menuSection: "drinks",
          productTaxRate: null,
        },
      ],
      pending: null,
      cartRevision: 2,
      updatedAt: "2026-05-27T12:00:00.000Z",
    });
    const state = aiOrderDraftToDenisCartState(draft);
    expect(state.draft.items).toHaveLength(1);
    expect(state.draft.cartRevision).toBe(2);
  });

  it("maps manual cart snapshot to Denis draft", () => {
    const draft = manualSnapshotToDenisDraft({
      revision: 4,
      updatedAt: "2026-05-27T12:00:00.000Z",
      items: [
        {
          productId: "p2",
          productName: "Cola Zero",
          quantity: 1,
          serveSize: null,
          lineTotal: 4,
        },
      ],
    });
    expect(draft?.items[0]?.productName).toBe("Cola Zero");
  });
});

describe("M7 intent mapping", () => {
  it("maps legacy intents to guest intents", () => {
    expect(mapLegacyIntentToGuest("order")).toBe("ORDER");
    expect(mapLegacyIntentToGuest("confirm")).toBe("CONFIRM");
    expect(mapLegacyIntentToGuest("menu_info")).toBe("BROWSE");
  });

  it("prefers T0 reflex intent when present", () => {
    expect(resolveTurnIntent("CONFIRM", "chat")).toBe("CONFIRM");
    expect(resolveTurnIntent(undefined, "order")).toBe("ORDER");
  });
});

describe("M7 surfaces", () => {
  it("rejects invalid chat body", async () => {
    const parsed = parseDenisChatBody({});
    expect(parsed.ok).toBe(false);
  });

  it("adds denis metadata to chat response", async () => {
    const response = formatChatTurnApiResponse(
      {
        message: "Hello",
        sessionId: "sess-1",
        intent: "chat",
      },
      {
        traceId: "trace-1",
        channel: "chat",
        flowNodeId: "welcome",
        topGoal: "OPEN_TABLE",
        conflictPrompt: null,
      }
    );
    const payload = await response.json();
    expect(payload.data.denis.traceId).toBe("trace-1");
    expect(payload.data.message).toBe("Hello");
  });
});
