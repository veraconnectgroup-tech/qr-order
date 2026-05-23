import type { MenuSection } from "@/lib/menu-section";

export const STANDARD_VAT_RATE = 19;
export const REDUCED_VAT_RATE = 7;

export type TaxBreakdownLine = { rate: number; amount: number };

export function resolveItemTaxRate(params: {
  productTaxRate: number | null | undefined;
  menuSection: MenuSection;
  isTakeaway: boolean;
  orgDefaultRate?: number;
}): number {
  const orgDefault = params.orgDefaultRate ?? STANDARD_VAT_RATE;

  if (params.menuSection === "drinks") {
    return STANDARD_VAT_RATE;
  }

  if (params.isTakeaway && params.productTaxRate === REDUCED_VAT_RATE) {
    return REDUCED_VAT_RATE;
  }

  if (params.productTaxRate === STANDARD_VAT_RATE) {
    return STANDARD_VAT_RATE;
  }

  if (params.productTaxRate == null) {
    return orgDefault;
  }

  return STANDARD_VAT_RATE;
}

export function itemTaxAmount(lineTotal: number, taxRate: number): number {
  return lineTotal * (taxRate / 100);
}

export function calculateOrderTaxFromItems(
  items: Array<{ lineTotal: number; taxRate: number }>
): {
  subtotal: number;
  taxAmount: number;
  total: number;
  breakdown: TaxBreakdownLine[];
  effectiveTaxPercent: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const byRate = new Map<number, number>();

  for (const item of items) {
    const tax = itemTaxAmount(item.lineTotal, item.taxRate);
    byRate.set(item.taxRate, (byRate.get(item.taxRate) ?? 0) + tax);
  }

  const breakdown = [...byRate.entries()]
    .map(([rate, amount]) => ({ rate, amount }))
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.rate - a.rate);

  const taxAmount = breakdown.reduce((sum, line) => sum + line.amount, 0);
  const total = subtotal + taxAmount;
  const effectiveTaxPercent =
    subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0;

  return { subtotal, taxAmount, total, breakdown, effectiveTaxPercent };
}

export function taxBreakdownFromOrderItems(
  items: Array<{ total: number; tax_rate: number }>
): TaxBreakdownLine[] {
  const byRate = new Map<number, number>();

  for (const item of items) {
    const rate = Number(item.tax_rate);
    const tax = itemTaxAmount(Number(item.total), rate);
    byRate.set(rate, (byRate.get(rate) ?? 0) + tax);
  }

  return [...byRate.entries()]
    .map(([rate, amount]) => ({ rate, amount }))
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.rate - a.rate);
}

export function cartTaxBreakdown(
  items: Array<{
    itemTotal: number;
    menuSection?: MenuSection;
    productTaxRate?: number | null;
  }>,
  isTakeaway: boolean,
  orgDefaultRate = STANDARD_VAT_RATE
): TaxBreakdownLine[] {
  const taxed = items.map((item) => ({
    lineTotal: item.itemTotal,
    taxRate: resolveItemTaxRate({
      productTaxRate: item.productTaxRate,
      menuSection: item.menuSection ?? "food",
      isTakeaway,
      orgDefaultRate,
    }),
  }));

  return calculateOrderTaxFromItems(taxed).breakdown;
}
