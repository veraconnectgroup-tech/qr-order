import {
  buildFiscalSaleLines,
  type FiscalSaleLine,
  type FiscalSaleTotals,
} from "@/lib/fiscal/runtime/build-fiscal-sale-lines";
import { grossTaxAmount, grossToNet, roundMoney } from "@/lib/tax/vat";

export function buildFiscalStornoLines(
  items: Array<{
    product_name: string;
    quantity: number;
    total: number;
    tax_rate: number | null;
  }>,
  stornoAmount: number,
  orderTotal: number
): FiscalSaleTotals {
  const ratio =
    orderTotal > 0 ? Math.min(1, stornoAmount / orderTotal) : 1;

  if (ratio >= 0.999) {
    return buildFiscalSaleLines(items);
  }

  const scaledItems = items.map((item) => ({
    ...item,
    total: roundMoney(Number(item.total) * ratio),
    quantity: Number(item.quantity) * ratio,
  }));

  const lines: FiscalSaleLine[] = scaledItems.map((item, index) => {
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

  const gross_total = roundMoney(lines.reduce((sum, line) => sum + line.gross, 0));
  const net_total = roundMoney(lines.reduce((sum, line) => sum + line.net, 0));
  const tax_total = roundMoney(lines.reduce((sum, line) => sum + line.tax, 0));

  return { gross_total, net_total, tax_total, lines };
}
