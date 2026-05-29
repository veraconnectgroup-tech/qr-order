import {
  calculateOrderTaxFromItems,
  grossToNet,
  grossTaxAmount,
  roundMoney,
} from "@/lib/tax/vat";

export type FiscalSaleLine = {
  line_no: number;
  product_name: string;
  quantity: number;
  tax_rate: number;
  gross: number;
  net: number;
  tax: number;
};

export type FiscalSaleTotals = {
  gross_total: number;
  net_total: number;
  tax_total: number;
  lines: FiscalSaleLine[];
};

export function buildFiscalSaleLines(
  items: Array<{
    product_name: string;
    quantity: number;
    total: number;
    tax_rate: number | null;
  }>
): FiscalSaleTotals {
  const normalized = items.map((item) => ({
    lineTotal: Number(item.total),
    taxRate: Number(item.tax_rate ?? 19),
  }));

  const taxResult = calculateOrderTaxFromItems(normalized);

  const lines: FiscalSaleLine[] = items.map((item, index) => {
    const gross = roundMoney(Number(item.total));
    const taxRate = Number(item.tax_rate ?? 19);
    const net = grossToNet(gross, taxRate);
    const tax = grossTaxAmount(gross, taxRate);

    return {
      line_no: index + 1,
      product_name: item.product_name,
      quantity: Number(item.quantity),
      tax_rate: taxRate,
      gross,
      net,
      tax,
    };
  });

  return {
    gross_total: taxResult.total,
    net_total: taxResult.subtotal,
    tax_total: taxResult.taxAmount,
    lines,
  };
}
