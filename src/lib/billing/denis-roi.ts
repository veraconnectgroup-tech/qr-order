export type BillingRoiJustification = {
  upsellRevenueEuros: number;
  planCostEuros: number;
  roiMultiplier: number;
  headline: string;
  detail: string;
  netBenefitEuros: number;
};

export function computeBillingRoiJustification(input: {
  upsellRevenueEuros: number;
  planCostEuros: number;
  currency?: string;
}): BillingRoiJustification {
  const upsell = Math.max(0, Math.round(input.upsellRevenueEuros * 100) / 100);
  const planCost = Math.max(0, Math.round(input.planCostEuros * 100) / 100);
  const roiMultiplier =
    planCost > 0 ? Math.round((upsell / planCost) * 10) / 10 : upsell > 0 ? Infinity : 0;
  const netBenefit = Math.round((upsell - planCost) * 100) / 100;

  const sym = input.currency === "EUR" || !input.currency ? "€" : input.currency;

  const headline = `Denis je generisao ${sym}${upsell.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} upsell revenue ovog meseca`;

  const roiLabel =
    roiMultiplier === Infinity
      ? "∞"
      : `${roiMultiplier.toLocaleString("de-DE", { maximumFractionDigits: 1 })}x`;

  const detail = `Vaš plan košta ${sym}${planCost.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}/mesec, Denis vam donosi ${sym}${upsell.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} — ROI: ${roiLabel}`;

  return {
    upsellRevenueEuros: upsell,
    planCostEuros: planCost,
    roiMultiplier,
    headline,
    detail,
    netBenefitEuros: netBenefit,
  };
}
