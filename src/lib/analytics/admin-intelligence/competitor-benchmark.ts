import type { CompetitorBenchmarkSnapshot } from "@/lib/analytics/admin-intelligence/types";

/** EU casual-dining QR ordering industry reference (public benchmark band). */
export const HOSPITALITY_INDUSTRY_BENCHMARK = {
  avgTicketEuros: 28.5,
  conversionRate: 0.58,
  cartAbandonmentRate: 0.42,
};

function pctDelta(venue: number, industry: number) {
  if (industry === 0) return venue > 0 ? 100 : 0;
  return Math.round(((venue - industry) / industry) * 1000) / 10;
}

export function buildCompetitorBenchmark(input: {
  venueAvgTicket: number;
  venueConversionRate: number;
  venueCartAbandonmentRate: number;
}): CompetitorBenchmarkSnapshot {
  const ticketDeltaPct = pctDelta(
    input.venueAvgTicket,
    HOSPITALITY_INDUSTRY_BENCHMARK.avgTicketEuros
  );
  const conversionDeltaPct = pctDelta(
    input.venueConversionRate * 100,
    HOSPITALITY_INDUSTRY_BENCHMARK.conversionRate * 100
  );

  let summary: string;
  if (ticketDeltaPct >= 5 && input.venueConversionRate >= HOSPITALITY_INDUSTRY_BENCHMARK.conversionRate) {
    summary =
      "Above industry on ticket size and conversion — Denis upsell is working.";
  } else if (ticketDeltaPct < 0) {
    summary =
      "Average ticket below industry — review Denis dessert/drink nudges and menu pricing.";
  } else if (input.venueCartAbandonmentRate > HOSPITALITY_INDUSTRY_BENCHMARK.cartAbandonmentRate * 100) {
    summary =
      "Cart abandonment above industry — simplify checkout and reduce friction before pay.";
  } else {
    summary = "Tracking near industry averages — room to optimize peak-hour conversion.";
  }

  return {
    industryAvgTicket: HOSPITALITY_INDUSTRY_BENCHMARK.avgTicketEuros,
    venueAvgTicket: Math.round(input.venueAvgTicket * 100) / 100,
    ticketDeltaPct,
    industryConversionRate: HOSPITALITY_INDUSTRY_BENCHMARK.conversionRate,
    venueConversionRate: input.venueConversionRate,
    conversionDeltaPct,
    industryCartAbandonmentRate:
      HOSPITALITY_INDUSTRY_BENCHMARK.cartAbandonmentRate * 100,
    venueCartAbandonmentRate: input.venueCartAbandonmentRate,
    summary,
  };
}
