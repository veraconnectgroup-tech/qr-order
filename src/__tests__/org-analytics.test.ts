import { describe, expect, it } from "vitest";
import {
  fetchOrgAnalytics,
  orgAnalyticsToCsv,
  type OrgAnalyticsData,
} from "@/lib/dashboard/org-analytics";

function mockAdmin() {
  return {
    from(table: string) {
      if (table === "locations") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [
                  {
                    id: "loc-1",
                    name: "Wien 1",
                    ai_concierge_config: { persona: { tone: "warm_short" } },
                  },
                  {
                    id: "loc-2",
                    name: "Salzburg",
                    ai_concierge_config: { persona: { tone: "formal" } },
                  },
                ],
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: async () => ({
                data: [
                  {
                    location_id: "loc-1",
                    metric_date: "2026-06-01",
                    sessions_closed: 423,
                    converted_sessions: 304,
                    session_revenue_total: 8240,
                    ai_cost_cents: 1820,
                  },
                  {
                    location_id: "loc-2",
                    metric_date: "2026-06-01",
                    sessions_closed: 156,
                    converted_sessions: 95,
                    session_revenue_total: 3440,
                    ai_cost_cents: 730,
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };
    },
  };
}

describe("org analytics", () => {
  it("aggregates three locations correctly", async () => {
    const data = await fetchOrgAnalytics(mockAdmin() as never, {
      orgId: "org-1",
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
    });

    expect(data.locations).toHaveLength(2);
    expect(data.totals.sessions).toBe(579);
    expect(data.totals.revenue).toBe(11680);
    expect(data.totals.aiCost).toBeCloseTo(25.5, 1);
    expect(data.insights.length).toBeGreaterThan(0);
  });

  it("exports CSV with totals row", () => {
    const data: OrgAnalyticsData = {
      period: { start: "2026-06-01", end: "2026-06-30" },
      locations: [
        {
          locationId: "loc-1",
          locationName: "Wien 1",
          sessions: 423,
          conversionRate: 0.72,
          revenue: 8240,
          aiCost: 18.2,
          personaTone: "warm_short",
        },
      ],
      totals: {
        sessions: 423,
        conversionRate: 0.72,
        revenue: 8240,
        aiCost: 18.2,
      },
      insights: [],
    };

    const csv = orgAnalyticsToCsv(data);
    expect(csv).toContain("Wien 1");
    expect(csv).toContain("TOTAL,423");
  });
});
