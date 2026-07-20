import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { DenisOrderCommandSchema } from "@/lib/denis/acl/denis-order-command.schema";
import { buildDenisOrderCommand } from "@/lib/denis/runtime/act/build-order-command";
import { actSubmitGuestBlockedMessage } from "@/lib/denis/runtime/act/resolve-act-submit-outcome";
import { executeActPhase } from "@/lib/denis/runtime/act/execute-act-phase";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";

describe("Denis M23 act + ACL", () => {
  it("act layer live by default — real submissions, not dry-run", () => {
    expect(CONCIERGE_PLATFORM_DEFAULTS.ordering.actLayerEnabled).toBe(true);
    expect(CONCIERGE_PLATFORM_DEFAULTS.ordering.actDryRun).toBe(false);
    expect(CONCIERGE_PLATFORM_DEFAULTS.ordering.actSubmitEnabled).toBe(true);
  });

  it("builds DenisOrderCommand from cart draft", () => {
    const command = buildDenisOrderCommand({
      aiSessionId: "00000000-0000-4000-8000-000000000001",
      tableToken: "a".repeat(32),
      deviceFingerprint: "device-fp-12345678",
      cartDraft: {
        cartRevision: 2,
        items: [
          {
            productId: "00000000-0000-4000-8000-000000000010",
            productName: "Cola",
            quantity: 2,
            serveSize: null,
            modifierIds: [],
            notes: "",
            lineTotal: 7,
          },
        ],
      },
    });

    expect(command?.lines).toHaveLength(1);
    expect(command?.idempotencyKey).toContain("00000000");
    expect(() => DenisOrderCommandSchema.parse(command)).not.toThrow();
  });

  it("maps submit errors to guest-visible messages", () => {
    expect(actSubmitGuestBlockedMessage("empty_cart")).toContain("prazna");
  });

  it("runs act phase in dry-run without side effects", async () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      ordering: {
        ...CONCIERGE_PLATFORM_DEFAULTS.ordering,
        actLayerEnabled: true,
        actDryRun: true,
      },
    };

    const reflexTurn = planTurnWithReflex({
      config,
      message: "dva piva",
      flowNodeId: "collect",
      cartState: emptyCartState(),
    });

    const phase = await executeActPhase({
      config,
      reflexTurn,
      legacySubmitOrder: false,
    });

    expect(phase.enabled).toBe(true);
    expect(phase.dryRun).toBe(true);
    expect(phase.results.length).toBeGreaterThan(0);
    expect(phase.results.every((row) => row.dryRun || row.skillId !== "order.submit")).toBe(
      true
    );
  });
});
