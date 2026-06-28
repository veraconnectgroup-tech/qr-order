import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import {
  buildPeerAddedPrompt,
  resolveCartConflict,
} from "@/lib/denis/kernel/conflict";
import { resolveSharedAiSessionId } from "@/lib/denis/venue/party";
import { mergePeerManualDraft } from "@/lib/denis/runtime/adapters/map-party-manual";
import type { PartyDeviceRow } from "@/lib/denis/venue/party/types";

function line(
  partial: Partial<DenisCartLine> & Pick<DenisCartLine, "productId" | "productName">
): DenisCartLine {
  return {
    quantity: 1,
    serveSize: null,
    modifierIds: [],
    notes: "",
    lineTotal: 4,
    menuSection: "drinks",
    ...partial,
  };
}

describe("party shared session M12", () => {
  it("uses shared ai session in shared_cart mode", () => {
    expect(
      resolveSharedAiSessionId({
        partyMode: "shared_cart",
        currentAiSessionId: "device-b",
        sharedAiSessionId: "shared-1",
        primaryAiSessionId: "device-a",
      })
    ).toBe("shared-1");
  });

  it("keeps per-device session in per_device mode", () => {
    expect(
      resolveSharedAiSessionId({
        partyMode: "per_device",
        currentAiSessionId: "device-b",
        sharedAiSessionId: "shared-1",
        primaryAiSessionId: "device-a",
      })
    ).toBe("device-b");
  });
});

describe("party peer manual M12", () => {
  const devices: PartyDeviceRow[] = [
    {
      deviceFingerprint: "phone-a",
      aiSessionId: "s1",
      displayName: null,
      isPrimary: true,
      manualCartRevision: 1,
      manualCartSnapshot: {
        revision: 1,
        updatedAt: new Date().toISOString(),
        items: [
          {
            productId: "cola-id",
            productName: "Cola",
            quantity: 1,
            serveSize: "0.5L",
            lineTotal: 4,
          },
        ],
      },
      lastActiveAt: new Date().toISOString(),
    },
    {
      deviceFingerprint: "phone-b",
      aiSessionId: "s2",
      displayName: null,
      isPrimary: false,
      manualCartRevision: 1,
      manualCartSnapshot: null,
      lastActiveAt: new Date().toISOString(),
    },
  ];

  it("merges peer carts excluding current device", () => {
    const peer = mergePeerManualDraft(devices, "phone-b");
    expect(peer.items).toHaveLength(1);
    expect(peer.items[0]?.productName).toBe("Cola");
  });

  it("uses peer-added Denis prompt for tablemate items", () => {
    const prompt = buildPeerAddedPrompt([
      line({ productId: "cola-id", productName: "Cola" }),
    ]);
    expect(prompt).toContain("Vidim da je neko već dodao Cola");
    expect(prompt).toContain("hoćete li još nešto");
  });

  it("overrides conflict prompt when peer manual diverges from ai draft", () => {
    const resolution = resolveCartConflict({
      ai: {
        items: [line({ productId: "espresso-id", productName: "Espresso" })],
        cartRevision: 1,
      },
      manual: { items: [], cartRevision: 0 },
      peerManual: {
        items: [line({ productId: "cola-id", productName: "Cola" })],
        cartRevision: 1,
      },
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });

    expect(resolution.guestPrompt).toContain("Vidim da je neko već dodao Cola");
  });
});
