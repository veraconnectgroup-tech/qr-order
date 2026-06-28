import type { OrderMode } from "@/lib/denis/commerce/delivery-mode";
import { isOffPremiseMode } from "@/lib/denis/commerce/delivery-mode";
import type { MenuSection } from "@/lib/menu-section";

export const STANDARD_VAT_RATE = 19;
export const REDUCED_VAT_RATE = 7;

export type TaxBreakdownLine = { rate: number; amount: number };

export type VatLineBreakdown = {
  rate: number;
  gross: number;
  net: number;
  tax: number;
  /** DSFinV-K field alias */
  ust: number;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isTakeawayForVat(mode: OrderMode | boolean): boolean {
  if (typeof mode === "boolean") return mode;
  return isOffPremiseMode(mode);
}

/** DSFinV-K INHAUS: 1 = dine-in (19%), 0 = takeaway/delivery (7% food). */
export function dsfinvkInhausFlag(mode: OrderMode | boolean): "0" | "1" {
  return isTakeawayForVat(mode) ? "0" : "1";
}

export function resolveItemTaxRate(params: {
  productTaxRate: number | null | undefined;
  menuSection: MenuSection;
  isTakeaway: boolean;
  orgDefaultRate?: number;
}): number {
  return resolveItemTaxRateForOrderMode({
    productTaxRate: params.productTaxRate,
    menuSection: params.menuSection,
    orderMode: params.isTakeaway ? "takeaway" : "dine_in",
    orgDefaultRate: params.orgDefaultRate,
  });
}

export function resolveItemTaxRateForOrderMode(params: {
  productTaxRate: number | null | undefined;
  menuSection: MenuSection;
  orderMode: OrderMode;
  orgDefaultRate?: number;
}): number {
  const orgDefault = params.orgDefaultRate ?? STANDARD_VAT_RATE;
  const isTakeaway = isOffPremiseMode(params.orderMode);

  if (params.menuSection === "drinks") {
    return STANDARD_VAT_RATE;
  }

  if (isTakeaway && params.productTaxRate === REDUCED_VAT_RATE) {
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

/** Menu line totals are gross (inkl. MwSt) — extract net from gross. */
export function grossToNet(gross: number, taxRate: number): number {
  return roundMoney(gross / (1 + taxRate / 100));
}

/** VAT portion extracted from a gross line total. */
export function grossTaxAmount(gross: number, taxRate: number): number {
  return roundMoney(gross - grossToNet(gross, taxRate));
}

/** @deprecated Use grossTaxAmount — line totals are gross-inclusive. */
export function itemTaxAmount(lineTotal: number, taxRate: number): number {
  return grossTaxAmount(lineTotal, taxRate);
}

export function lineVatBreakdown(gross: number, taxRate: number): VatLineBreakdown {
  const net = grossToNet(gross, taxRate);
  const tax = roundMoney(gross - net);
  return {
    rate: taxRate,
    gross: roundMoney(gross),
    net,
    tax,
    ust: tax,
  };
}

export function groupGrossByRate(
  items: Array<{ gross: number; taxRate: number }>
): VatLineBreakdown[] {
  const buckets = new Map<number, number>();

  for (const item of items) {
    buckets.set(item.taxRate, (buckets.get(item.taxRate) ?? 0) + item.gross);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, gross]) => lineVatBreakdown(gross, rate));
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
  const grossTotal = roundMoney(
    items.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const byRate = new Map<number, number>();

  for (const item of items) {
    const tax = grossTaxAmount(item.lineTotal, item.taxRate);
    byRate.set(item.taxRate, (byRate.get(item.taxRate) ?? 0) + tax);
  }

  const breakdown = [...byRate.entries()]
    .map(([rate, amount]) => ({ rate, amount: roundMoney(amount) }))
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.rate - a.rate);

  const taxAmount = roundMoney(
    breakdown.reduce((sum, line) => sum + line.amount, 0)
  );
  const total = grossTotal;
  const subtotal = roundMoney(total - taxAmount);
  const effectiveTaxPercent =
    subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0;

  return { subtotal, taxAmount, total, breakdown, effectiveTaxPercent };
}

export function taxBreakdownFromOrderItems(
  items: Array<{ total: number; tax_rate: number }>
): TaxBreakdownLine[] {
  return calculateOrderTaxFromItems(
    items.map((item) => ({
      lineTotal: Number(item.total),
      taxRate: Number(item.tax_rate),
    }))
  ).breakdown;
}

export function cartTaxBreakdown(
  items: Array<{
    itemTotal: number;
    menuSection?: MenuSection;
    productTaxRate?: number | null;
    fulfillmentMode?: OrderMode;
  }>,
  orderMode: OrderMode | boolean,
  orgDefaultRate = STANDARD_VAT_RATE
): TaxBreakdownLine[] {
  const defaultMode: OrderMode =
    typeof orderMode === "boolean"
      ? orderMode
        ? "takeaway"
        : "dine_in"
      : orderMode;

  const taxed = items.map((item) => ({
    lineTotal: item.itemTotal,
    taxRate: resolveItemTaxRateForOrderMode({
      productTaxRate: item.productTaxRate,
      menuSection: item.menuSection ?? "food",
      orderMode: item.fulfillmentMode ?? defaultMode,
      orgDefaultRate,
    }),
  }));

  return calculateOrderTaxFromItems(taxed).breakdown;
}
