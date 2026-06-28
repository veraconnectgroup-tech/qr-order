import { describe, expect, it } from "vitest";
import {
  consolidatedInvoiceSummary,
  type ConsolidatedOrgInvoice,
} from "@/lib/billing/consolidated-invoice";
import {
  bestLocationForMenuItem,
  type CrossLocationMenuItemRow,
} from "@/lib/org/cross-location-analytics";
import {
  resolveEffectiveVenueConfig,
  type LocationLevelOverrides,
  type OrgLevelDefaults,
} from "@/lib/org/config-inheritance";
import { fetchOrgHub } from "@/lib/org/org-hub";
import {
  isFloatingStaff,
  setStaffLocations,
} from "@/lib/staff/staff-locations";

describe("config inheritance", () => {
  it("merges org playbook with location override", () => {
    const org: OrgLevelDefaults = {
      orgId: "org-1",
      orgName: "Vera Group",
      currency: "EUR",
      planId: "business",
      logoUrl: "/logo.png",
      coverImageUrl: null,
      defaultPlaybook: { persona: { tone: "warm" } },
      platformFeePercent: 2,
      platformFeeFixed: 0,
    };

    const location: LocationLevelOverrides = {
      locationId: "loc-berlin",
      locationName: "Berlin Mitte",
      timezone: "Europe/Berlin",
      defaultLocale: "de",
      menuLocale: "de",
      operatingHours: { mon: "09:00-22:00" },
      aiPlaybook: null,
      locationPlaybook: { persona: { tone: "formal" } },
      inPersonPayment: true,
    };

    const effective = resolveEffectiveVenueConfig(org, location);
    expect(effective.effectivePlaybook).toEqual({ persona: { tone: "formal" } });
    expect(effective.org.currency).toBe("EUR");
    expect(effective.location.timezone).toBe("Europe/Berlin");
  });

  it("falls back to org playbook when location has no override", () => {
    const org: OrgLevelDefaults = {
      orgId: "org-1",
      orgName: "Vera",
      currency: "EUR",
      planId: "starter",
      logoUrl: null,
      coverImageUrl: null,
      defaultPlaybook: { language: { venueDefault: "de" } },
      platformFeePercent: 2.5,
      platformFeeFixed: 0,
    };

    const location: LocationLevelOverrides = {
      locationId: "loc-hh",
      locationName: "Hamburg",
      timezone: "Europe/Berlin",
      defaultLocale: "de",
      menuLocale: null,
      operatingHours: null,
      aiPlaybook: null,
      locationPlaybook: null,
      inPersonPayment: false,
    };

    const effective = resolveEffectiveVenueConfig(org, location);
    expect(effective.effectivePlaybook).toEqual({ language: { venueDefault: "de" } });
  });
});

describe("fetchOrgHub — 3 locations aggregated revenue", () => {
  function mockAdminThreeLocations() {
    return {
      from(table: string) {
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { name: "Vera Group", currency: "EUR" },
                }),
              }),
            }),
          };
        }

        if (table === "locations") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    { id: "loc-berlin", name: "Berlin", city: "Berlin", is_active: true },
                    { id: "loc-hamburg", name: "Hamburg", city: "Hamburg", is_active: true },
                    { id: "loc-munich", name: "München", city: "München", is_active: true },
                  ],
                }),
              }),
            }),
          };
        }

        if (table === "orders") {
          return {
            select: () => ({
              in: () => ({
                gte: async () => ({
                  data: [
                    { location_id: "loc-berlin", total: 1000, status: "delivered" },
                    { location_id: "loc-berlin", total: 500, status: "delivered" },
                    { location_id: "loc-hamburg", total: 800, status: "delivered" },
                    { location_id: "loc-munich", total: 1200, status: "delivered" },
                    { location_id: "loc-munich", total: 300, status: "cancelled" },
                  ],
                }),
              }),
            }),
          };
        }

        if (table === "experience_analytics_daily") {
          return {
            select: () => ({
              eq: () => ({
                gte: async () => ({
                  data: [
                    {
                      location_id: "loc-berlin",
                      sessions_closed: 100,
                      converted_sessions: 70,
                      experience_score: 85,
                    },
                    {
                      location_id: "loc-hamburg",
                      sessions_closed: 50,
                      converted_sessions: 30,
                      experience_score: 78,
                    },
                    {
                      location_id: "loc-munich",
                      sessions_closed: 80,
                      converted_sessions: 60,
                      experience_score: 90,
                    },
                  ],
                }),
              }),
            }),
          };
        }

        if (table === "staff") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: async () => ({
                    data: [
                      { id: "staff-1", location_id: "loc-berlin" },
                      { id: "staff-2", location_id: "loc-hamburg" },
                      { id: "staff-3", location_id: "loc-munich" },
                    ],
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "staff_locations") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { staff_id: "staff-float", location_id: "loc-berlin" },
                  { staff_id: "staff-float", location_id: "loc-hamburg" },
                ],
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null }),
            }),
          }),
        };
      },
    };
  }

  it("aggregates revenue across 3 locations", async () => {
    const data = await fetchOrgHub(mockAdminThreeLocations() as never, "org-1", {
      periodDays: 30,
    });

    expect(data.locations).toHaveLength(3);
    expect(data.totals.revenue).toBe(3500);
    expect(data.totals.orders).toBe(4);
    expect(data.comparison).not.toBeNull();
    expect(data.comparison!.leftName).toBeTruthy();
  });
});

describe("cross-location menu analytics", () => {
  it("finds best location for a menu item", () => {
    const rows: CrossLocationMenuItemRow[] = [
      {
        productName: "Burger",
        locationId: "loc-berlin",
        locationName: "Berlin",
        quantitySold: 40,
        revenue: 800,
      },
      {
        productName: "Burger",
        locationId: "loc-hamburg",
        locationName: "Hamburg",
        quantitySold: 60,
        revenue: 1200,
      },
    ];

    const best = bestLocationForMenuItem(rows, "Burger");
    expect(best?.locationName).toBe("Hamburg");
    expect(best?.revenue).toBe(1200);
  });
});

describe("floating staff", () => {
  it("detects floating staff with multiple locations", () => {
    expect(isFloatingStaff(["loc-1", "loc-2"])).toBe(true);
    expect(isFloatingStaff(["loc-1"])).toBe(false);
    expect(isFloatingStaff([])).toBe(false);
  });

  it("assigns staff to multiple locations via junction table", async () => {
    const inserts: unknown[] = [];
    const deletes: string[] = [];

    const admin = {
      from(table: string) {
        if (table === "locations") {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({
                  data: [{ id: "loc-a" }, { id: "loc-b" }],
                }),
              }),
            }),
          };
        }

        if (table === "staff") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "staff-1", org_id: "org-1" },
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }

        if (table === "staff_locations") {
          return {
            delete: () => ({
              eq: (_col: string, val: string) => {
                deletes.push(val);
                return Promise.resolve({ error: null });
              },
            }),
            insert: (rows: unknown) => {
              inserts.push(rows);
              return Promise.resolve({ error: null });
            },
          };
        }

        return {};
      },
    };

    const result = await setStaffLocations(admin as never, {
      orgId: "org-1",
      staffId: "staff-1",
      locationIds: ["loc-a", "loc-b"],
    });

    expect(result.primaryLocationId).toBe("loc-a");
    expect(deletes).toContain("staff-1");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual([
      { staff_id: "staff-1", location_id: "loc-a" },
      { staff_id: "staff-1", location_id: "loc-b" },
    ]);
  });
});

describe("centralized billing", () => {
  it("summarizes one invoice for all locations", () => {
    const invoice: ConsolidatedOrgInvoice = {
      orgId: "org-1",
      orgName: "Vera Group",
      currency: "EUR",
      periodLabel: "Juni 2026",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      singleInvoice: true,
      locations: [
        {
          locationId: "loc-1",
          locationName: "Berlin",
          orderCount: 10,
          grossRevenue: 1500,
          platformFee: 30,
          netToVenue: 1470,
        },
        {
          locationId: "loc-2",
          locationName: "Hamburg",
          orderCount: 8,
          grossRevenue: 900,
          platformFee: 18,
          netToVenue: 882,
        },
      ],
      totals: {
        orderCount: 18,
        grossRevenue: 2400,
        platformFee: 48,
        netToVenue: 2352,
      },
    };

    const summary = consolidatedInvoiceSummary(invoice);
    expect(summary).toContain("Vera Group");
    expect(summary).toContain("2400.00");
    expect(summary).toContain("2 location");
    expect(summary).toContain("consolidated");
  });
});
