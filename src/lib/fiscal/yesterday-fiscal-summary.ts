import { formatPrice } from "@/lib/format";

export type YesterdayFiscalSnapshot = {
  orderCount: number;
  totalGross: number;
  refundCount: number;
  currency?: string;
};

/** Denis staff copilot line — e.g. "Juče: 47 narudžbina, €2.340 prihod, 2 storna". */
export function formatYesterdayFiscalSummaryLine(
  snapshot: YesterdayFiscalSnapshot,
  options?: { locale?: "sr" | "de" }
): string {
  const locale = options?.locale ?? "sr";
  const currency = snapshot.currency ?? "EUR";
  const revenueLabel = formatPrice(snapshot.totalGross, currency);

  const orderWord =
    locale === "de"
      ? snapshot.orderCount === 1
        ? "Bestellung"
        : "Bestellungen"
      : snapshot.orderCount === 1
        ? "narudžbina"
        : snapshot.orderCount >= 2 && snapshot.orderCount <= 4
          ? "narudžbine"
          : "narudžbina";

  const stornoWord =
    locale === "de"
      ? snapshot.refundCount === 1
        ? "Storno"
        : "Stornos"
      : snapshot.refundCount === 1
        ? "storno"
        : "storna";

  const prefix = locale === "de" ? "Gestern" : "Juče";

  if (snapshot.refundCount > 0) {
    return `${prefix}: ${snapshot.orderCount} ${orderWord}, ${revenueLabel} prihod, ${snapshot.refundCount} ${stornoWord}`;
  }

  return `${prefix}: ${snapshot.orderCount} ${orderWord}, ${revenueLabel} prihod`;
}
