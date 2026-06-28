/** Public landing ROI estimator — marketing calculator, not billing truth. */
export function computeLandingRoiEstimate(input: {
  coversPerDay: number;
  averageTicketEuros: number;
  upsellUpliftPercent: number;
  planCostEuros?: number;
}): {
  monthlyUpliftEuros: number;
  monthlyRevenueEuros: number;
  roiMultiplier: number;
} {
  const covers = Math.max(0, input.coversPerDay);
  const ticket = Math.max(0, input.averageTicketEuros);
  const upliftPct = Math.max(0, Math.min(50, input.upsellUpliftPercent));
  const planCost = Math.max(0, input.planCostEuros ?? 0);

  const dailyBase = covers * ticket;
  const dailyUplift = dailyBase * (upliftPct / 100);
  const monthlyUplift = Math.round(dailyUplift * 30);
  const monthlyRevenue = Math.round(dailyBase * 30);
  const roiMultiplier =
    planCost > 0
      ? Math.round((monthlyUplift / planCost) * 10) / 10
      : monthlyUplift > 0
        ? Infinity
        : 0;

  return {
    monthlyUpliftEuros: monthlyUplift,
    monthlyRevenueEuros: monthlyRevenue,
    roiMultiplier,
  };
}

export function formatLandingEuros(value: number, locale: string): string {
  return `€${value.toLocaleString(locale === "de" ? "de-DE" : locale === "sr" ? "sr-RS" : "en-US", {
    maximumFractionDigits: 0,
  })}`;
}
