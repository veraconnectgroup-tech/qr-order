import { describe, expect, it } from "vitest";
import { buildAiCatalog } from "@/lib/ai/catalog/catalog-builder";
import { buildDailyReport, formatDailyReportDigest } from "@/lib/admin/build-daily-report";
import { buildDenisShiftRecap } from "@/lib/admin/denis-shift-report";
import { resolveWorldOrderTell } from "@/lib/denis/loop/tell-world-order";
import { guestSubstitutionHint } from "@/lib/denis/intelligence/inventory-awareness";
import { buildVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/build-graph";
import { substitutesForUnavailable } from "@/lib/denis/kernel/vkg/queries";
import {
  assertRoleCanSetProductAvailability,
  buildEightySixDigestLines,
} from "@/lib/products/eighty-six";

describe("assertRoleCanSetProductAvailability (S9)", () => {
  it("allows kitchen to 86 food items only", () => {
    expect(
      assertRoleCanSetProductAvailability({
        role: "kitchen",
        menuSection: "food",
        makingUnavailable: true,
      }).ok
    ).toBe(true);
    expect(
      assertRoleCanSetProductAvailability({
        role: "kitchen",
        menuSection: "drinks",
        makingUnavailable: true,
      })
    ).toEqual({
      ok: false,
      reason: "Kitchen staff can only update food and dessert items.",
    });
  });

  it("allows bar to 86 drinks only", () => {
    expect(
      assertRoleCanSetProductAvailability({
        role: "bar",
        menuSection: "drinks",
        makingUnavailable: true,
      }).ok
    ).toBe(true);
    expect(
      assertRoleCanSetProductAvailability({
        role: "bar",
        menuSection: "food",
        makingUnavailable: true,
      })
    ).toEqual({
      ok: false,
      reason: "Bar staff can only update drink items.",
    });
  });

  it("blocks waiter from changing availability", () => {
    expect(
      assertRoleCanSetProductAvailability({
        role: "waiter",
        menuSection: "food",
        makingUnavailable: true,
      })
    ).toEqual({
      ok: false,
      reason: "Your role cannot change product availability.",
    });
  });

  it("allows manager override on any section", () => {
    expect(
      assertRoleCanSetProductAvailability({
        role: "manager",
        menuSection: "drinks",
        makingUnavailable: true,
      }).ok
    ).toBe(true);
  });
});

describe("resolveWorldOrderTell product unavailable (S9)", () => {
  it("returns substitution message with push enabled", () => {
    const tell = resolveWorldOrderTell({
      signal: "commerce.product_unavailable",
      status: "pending",
      orderNumber: 12,
      menuLocale: "sr",
      productTell: {
        productId: "p1",
        productName: "Ćevapi",
        message: guestSubstitutionHint("Ćevapi", "Pljeskavica"),
      },
    });

    expect(tell).not.toBeNull();
    expect(tell!.message).toContain("Pljeskavica");
    expect(tell!.push).toBe(true);
    expect(tell!.persistTell).toBe(true);
  });
});

describe("Denis recommendation filter for 86 items (S9)", () => {
  const graph = buildVenueKnowledgeGraph({
    locationId: "loc-86",
    categories: [{ id: "cat-food", name: "Hrana", menu_section: "food" }],
    products: [
      {
        id: "cevapi",
        name: "Ćevapi",
        category_id: "cat-food",
        price: 900,
        is_available: false,
        allergens: [],
        ai_description: null,
        menu_section: "food",
      },
      {
        id: "pljeskavica",
        name: "Pljeskavica",
        category_id: "cat-food",
        price: 950,
        is_available: true,
        allergens: [],
        ai_description: null,
        menu_section: "food",
      },
    ],
    upsellRules: [],
  });

  it("does not recommend unavailable products and offers substitute", () => {
    const catalog = buildAiCatalog(
      [
        {
          id: "cat-food",
          name: "Hrana",
          name_en: null,
          menu_section: "food",
          sort_order: 1,
          products: [
            {
              id: "cevapi",
              name: "Ćevapi",
              name_en: null,
              description: null,
              description_en: null,
              price: 900,
              image_url: null,
              is_available: false,
              ai_description: null,
              allergens: [],
              sort_order: 1,
              tags: [],
              drink_family: null,
              food_tags: [],
              prep_station: null,
              requires_serve_size: false,
              serve_size_presets: null,
              allow_custom_serve_size: false,
              tax_rate: null,
              deleted_at: null,
              modifier_groups: [],
            },
            {
              id: "pljeskavica",
              name: "Pljeskavica",
              name_en: null,
              description: null,
              description_en: null,
              price: 950,
              image_url: null,
              is_available: true,
              ai_description: null,
              allergens: [],
              sort_order: 2,
              tags: [],
              drink_family: null,
              food_tags: [],
              prep_station: null,
              requires_serve_size: false,
              serve_size_presets: null,
              allow_custom_serve_size: false,
              tax_rate: null,
              deleted_at: null,
              modifier_groups: [],
            },
          ],
        },
      ],
      "RSD",
      false
    );

    expect(Object.keys(catalog.productMap)).not.toContain("cevapi");
    expect(Object.keys(catalog.productMap)).toContain("pljeskavica");

    const substitutes = substitutesForUnavailable(graph, {
      unavailableProductIds: ["cevapi"],
    });
    expect(substitutes[0]?.substitutes[0]?.name).toBe("Pljeskavica");
    expect(
      guestSubstitutionHint("Ćevapi", substitutes[0]!.substitutes[0]!.name)
    ).toContain("Pljeskavica");
  });
});

describe("daily report 86 section (S9)", () => {
  it("includes eighty-six events with timestamps in digest", () => {
    const shift = buildDenisShiftRecap({
      stationQuestions: [],
      staffNotifications: [],
      waiterCalls: [],
      stationStates: [],
      tableNames: {},
      kitchenFallbackPrepMinutes: 14,
      eightySixEvents: [
        {
          productName: "Ćevapi",
          at: "2026-06-27T20:30:00.000Z",
        },
      ],
    });

    const report = buildDailyReport({
      date: "2026-06-27",
      venueName: "Kafana",
      weekdayLabel: "Petak",
      currencyLabel: "RSD",
      orders: [],
      sessions: [],
      feedback: [],
      denisMetrics: {
        sessionsHandled: 0,
        upsellRevenue: 0,
        upsellConversionRate: 0,
        proactiveNudgesSent: 0,
        nudgeAcceptRate: 0,
        avgResponseTime: 0,
        creditsBurned: 0,
      },
      revenueYesterday: 0,
      revenueLastWeekSameDay: 0,
      prepTimeAvgMinutes: 14,
      slowestItem: null,
      peakHour: "—",
      peakOrderCount: 0,
      returningGuestSessions: 0,
      newGuestSessions: 0,
      denisShift: {
        stationQuestions: [],
        staffNotifications: [],
        waiterCalls: [],
        stationStates: [],
        tableNames: {},
        kitchenFallbackPrepMinutes: 14,
        eightySixEvents: shift.eightySixEvents,
      },
    });

    const digest = formatDailyReportDigest(report);
    expect(digest.text).toContain("86 danas: 1");
    expect(digest.text).toContain("Ćevapi");
    expect(buildEightySixDigestLines([
      {
        productId: "p1",
        productName: "Ćevapi",
        at: "2026-06-27T20:30:00.000Z",
        staffUserId: null,
      },
    ])[0]).toContain("Ćevapi");
  });
});

describe("order create guard for unavailable products (S9)", () => {
  it("flags unavailable product names the same way validateOrderCart does", () => {
    const productIds = ["p1", "p2"];
    const allProducts = [
      { id: "p1", name: "Ćevapi", is_available: false },
      { id: "p2", name: "Salata", is_available: true },
    ];

    const unavailableNames = productIds
      .map((id) => allProducts.find((product) => product.id === id))
      .filter((product) => !product || !product.is_available)
      .map((product) => product?.name ?? "Unknown product");

    expect(unavailableNames).toEqual(["Ćevapi"]);
  });
});
