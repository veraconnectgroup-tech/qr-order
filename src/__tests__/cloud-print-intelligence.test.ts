import { describe, expect, it } from "vitest";
import { appendBelegTseEscPos } from "@/lib/fiscal/beleg";
import {
  buildKitchenTicketEscPos,
  formatAllergyBanner,
} from "@/lib/printer/format-kitchen-ticket";
import {
  buildReceiptEscPos,
  DENIS_RECEIPT_FOOTER,
} from "@/lib/printer/format-receipt";
import { EscPosBuilder } from "@/lib/printer/escpos-builder";
import { planKitchenPrintJobs } from "@/lib/printer/print-routing";
import { splitOrderItemsByTarget } from "@/lib/printer/split-items";
import type { OrderWithDetails } from "@/types";

function decodeEscPos(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function sampleOrder(overrides: Partial<OrderWithDetails> = {}): OrderWithDetails {
  return {
    id: "order-1",
    order_number: 42,
    created_at: "2026-06-28T12:00:00.000Z",
    session_id: "session-1",
    is_takeaway: false,
    subtotal: 20,
    tax_percent: 19,
    tax_amount: 3.2,
    total: 20,
    payment_method: "online",
    payment_status: "paid",
    notes: null,
    tse_signature: "sig-abc123456789012345678901234567890",
    tse_data: {
      tss_serial: "TSS-1",
      qr_code_data: "V0;1234567890;42;2026-06-28T12:00:00",
      start_time: 1_748_006_400,
      end_time: 1_748_006_401,
    },
    tables: { name: "Table 8" },
    order_items: [
      {
        id: "item-1",
        product_id: "burger-id",
        product_name: "Classic Burger",
        quantity: 1,
        total: 12,
        menu_section: "food",
        notes: null,
        order_item_modifiers: [],
      },
      {
        id: "item-2",
        product_id: "beer-id",
        product_name: "Pilsner 0.5L",
        quantity: 2,
        total: 8,
        menu_section: "drinks",
        notes: null,
        order_item_modifiers: [],
      },
    ],
    ...overrides,
  } as OrderWithDetails;
}

describe("cloud print routing", () => {
  it("burger+beer → 2 tickets on kitchen + bar printers", () => {
    const order = sampleOrder();
    const productTargets = {
      "burger-id": "kitchen" as const,
      "beer-id": "bar" as const,
    };

    const jobs = planKitchenPrintJobs({
      order,
      productTargets,
      printers: [
        { id: "kitchen-printer", print_for: ["kitchen"] },
        { id: "bar-printer", print_for: ["bar"] },
      ],
    });

    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.stationLabel).sort()).toEqual(["BAR", "KUHINJA"]);
    expect(jobs.find((job) => job.stationLabel === "KUHINJA")?.itemCount).toBe(1);
    expect(jobs.find((job) => job.stationLabel === "BAR")?.itemCount).toBe(1);
  });

  it("drinks-only order routes to bar printer only", () => {
    const order = sampleOrder({
      order_items: [sampleOrder().order_items[1]!],
    });

    const split = splitOrderItemsByTarget(order, {
      "beer-id": "bar",
    });

    expect(split.bar).toHaveLength(1);
    expect(split.kitchen).toHaveLength(0);

    const jobs = planKitchenPrintJobs({
      order,
      productTargets: { "beer-id": "bar" },
      printers: [
        { id: "kitchen-printer", print_for: ["kitchen"] },
        { id: "bar-printer", print_for: ["bar"] },
      ],
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.stationLabel).toBe("BAR");
  });
});

describe("kitchen ticket formatting", () => {
  it("prints allergies in BOLD CAPS banner", () => {
    const ticket = buildKitchenTicketEscPos(
      sampleOrder(),
      "Skyline Lounge",
      80,
      "KUHINJA",
      { allergyLabels: ["gluten", "nuts"] }
    );
    const text = decodeEscPos(ticket);
    expect(text).toContain("ALLERGIE:");
    expect(text).toContain("GLUTEN");
    expect(text).toContain("NUTS");
    expect(formatAllergyBanner(["gluten"])).toBe("GLUTEN");
  });

  it("adjusts layout for 58mm paper width", () => {
    const ticket58 = decodeEscPos(
      buildKitchenTicketEscPos(sampleOrder(), "Test", 58, "BAR")
    );
    const ticket80 = decodeEscPos(
      buildKitchenTicketEscPos(sampleOrder(), "Test", 80, "BAR")
    );
    expect(ticket58).toContain("BAR");
    expect(ticket80).toContain("BAR");
    expect(ticket58.length).toBeLessThan(ticket80.length);
  });
});

describe("receipt formatting", () => {
  it("includes logo marker, Denis footer, and TSE QR command", () => {
    const receipt = buildReceiptEscPos(
      sampleOrder(),
      { name: "Skyline Lounge", logo_url: "https://cdn/logo.png" },
      {
        address: "Main St 1",
        city: "Berlin",
        in_person_payment_location: "table",
      },
      80,
      "EUR"
    );

    const text = decodeEscPos(receipt);
    expect(text).toContain("★");
    expect(text).toContain("Skyline Lounge");
    expect(text).toContain(DENIS_RECEIPT_FOOTER);

    const builder = new EscPosBuilder();
    appendBelegTseEscPos(
      builder,
      {
        tseSignature: sampleOrder().tse_signature!,
        tseData: sampleOrder().tse_data as never,
      },
      80
    );
    const bytes = builder.build();
    expect(bytes.some((byte, index, arr) => byte === 0x1d && arr[index + 1] === 0x28)).toBe(
      true
    );
    expect(text).toContain("TSE-signiert");
  });
});

describe("EscPosBuilder QR", () => {
  it("emits GS ( k QR store/print sequence", () => {
    const bytes = new EscPosBuilder().initialize().align("center").qrCode("V0;test").build();
    const hasQrHeader = bytes.some(
      (byte, index) => byte === 0x1d && bytes[index + 1] === 0x28 && bytes[index + 2] === 0x6b
    );
    expect(hasQrHeader).toBe(true);
  });
});
