import { describe, expect, it } from "vitest";
import {
  buildKitchenPrepBatches,
  extractKitchenAllergyBanner,
  kdsUrgencyForMinutes,
  kdsUrgencyForOrder,
  sortKitchenOrdersByUrgency,
} from "@/lib/kitchen/kds-intelligence";
import { detectOrderPreparingNotifyTrigger } from "@/lib/denis/cognition/proactive/triggers";
import { buildOrderPreparingNotifyMessage } from "@/lib/denis/cognition/proactive/proactive-message-builders";
import type { OrderWithDetails } from "@/types";

const now = Date.parse("2026-06-07T20:00:00.000Z");

function kitchenOrder(
  partial: Partial<OrderWithDetails> & { id: string }
): OrderWithDetails {
  return {
    id: partial.id,
    location_id: "loc-1",
    table_id: partial.table_id ?? "t1",
    session_id: partial.session_id ?? "s1",
    order_number: partial.order_number ?? 1,
    status: partial.status ?? "accepted",
    subtotal: 10,
    tax_percent: 19,
    tax_amount: 1.9,
    total: 11.9,
    payment_status: "unpaid",
    payment_method: "card",
    created_at:
      partial.created_at ?? new Date(now - 12 * 60_000).toISOString(),
    accepted_at: partial.accepted_at ?? null,
    preparing_at: partial.preparing_at ?? null,
    ready_at: partial.ready_at ?? null,
    delivered_at: partial.delivered_at ?? null,
    notes: partial.notes ?? null,
    order_items: partial.order_items ?? [
      {
        id: "oi-1",
        order_id: partial.id,
        product_id: "p1",
        product_name: "Schnitzel",
        quantity: 1,
        unit_price: 10,
        total: 10,
        tax_rate: 19,
        menu_section: "food",
        notes: null,
        order_item_modifiers: [],
      },
    ],
    tables: partial.tables ?? { name: partial.id.replace("o", "T") },
  } as unknown as OrderWithDetails;
}

describe("kds urgency", () => {
  it("marks 10min+ wait as red", () => {
    expect(kdsUrgencyForMinutes(10)).toBe("red");
    expect(kdsUrgencyForMinutes(12)).toBe("red");
    const order = kitchenOrder({
      id: "o1",
      created_at: new Date(now - 11 * 60_000).toISOString(),
    });
    expect(kdsUrgencyForOrder(order, now)).toBe("red");
  });

  it("sorts red orders before green", () => {
    const sorted = sortKitchenOrdersByUrgency(
      [
        kitchenOrder({
          id: "o-green",
          created_at: new Date(now - 2 * 60_000).toISOString(),
        }),
        kitchenOrder({
          id: "o-red",
          created_at: new Date(now - 12 * 60_000).toISOString(),
        }),
      ],
      now
    );
    expect(sorted[0]?.id).toBe("o-red");
  });
});

describe("prep batch grouping", () => {
  it("groups 3x same item from different tables", () => {
    const batches = buildKitchenPrepBatches([
      kitchenOrder({
        id: "o1",
        tables: { name: "3" },
        order_items: [
          {
            id: "oi-1",
            order_id: "o1",
            product_id: "p1",
            product_name: "Schnitzel",
            quantity: 1,
            unit_price: 10,
            total: 10,
            tax_rate: 19,
            menu_section: "food",
            notes: null,
            order_item_modifiers: [],
          },
        ],
      }),
      kitchenOrder({
        id: "o2",
        tables: { name: "5" },
        order_items: [
          {
            id: "oi-2",
            order_id: "o2",
            product_id: "p1",
            product_name: "Schnitzel",
            quantity: 1,
            unit_price: 10,
            total: 10,
            tax_rate: 19,
            menu_section: "food",
            notes: null,
            order_item_modifiers: [],
          },
        ],
      }),
      kitchenOrder({
        id: "o3",
        tables: { name: "8" },
        order_items: [
          {
            id: "oi-3",
            order_id: "o3",
            product_id: "p1",
            product_name: "Schnitzel",
            quantity: 1,
            unit_price: 10,
            total: 10,
            tax_rate: 19,
            menu_section: "food",
            notes: null,
            order_item_modifiers: [],
          },
        ],
      }),
    ]);

    expect(batches.length).toBe(1);
    expect(batches[0]?.totalQuantity).toBe(3);
    expect(batches[0]?.label).toContain("3x Schnitzel");
    expect(batches[0]?.label).toContain("3");
    expect(batches[0]?.label).toContain("5");
    expect(batches[0]?.label).toContain("8");
  });
});

describe("allergy banner", () => {
  it("shows red gluten-free banner for sto 3", () => {
    const banner = extractKitchenAllergyBanner(
      kitchenOrder({
        id: "o-allergy",
        tables: { name: "3" },
        notes: "BEZ GLUTENA — koristiti GF hleb",
      })
    );
    expect(banner).not.toBeNull();
    expect(banner?.headline).toContain("STO 3");
    expect(banner?.headline).toContain("BEZ GLUTENA");
    expect(banner?.detail).toContain("GF hleb");
  });
});

describe("order preparing notify", () => {
  it("fires order_eta_update when kitchen just started prep", () => {
    const trigger = detectOrderPreparingNotifyTrigger(
      [
        {
          id: "o-prep",
          status: "preparing",
          created_at: new Date(now - 5 * 60_000).toISOString(),
          delivered_at: null,
          preparing_at: new Date(now - 60_000).toISOString(),
          estimated_prep_minutes: 8,
          prep_estimate_confidence: "medium",
          order_items: [
            {
              product_id: "burger",
              product_name: "Burger",
              unit_price: 12,
              quantity: 1,
              menu_section: "food",
            },
          ],
        },
      ],
      () => false,
      now
    );
    expect(trigger?.kind).toBe("order_eta_update");
    expect(trigger?.remainingEtaMinutes).toBe(8);
    const message = buildOrderPreparingNotifyMessage({
      language: "sr",
      orderItemsLabel: "Burger",
      remainingEtaMinutes: 8,
    });
    expect(message).toContain("Burger");
    expect(message).toContain("8");
  });
});
