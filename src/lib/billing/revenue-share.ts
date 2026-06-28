export function computePlatformFeeAmount(input: {
  orderTotal: number;
  feePercent: number;
  feeFixed: number;
}): number {
  const percentPart = (input.orderTotal * input.feePercent) / 100;
  return Math.round((percentPart + input.feeFixed) * 100) / 100;
}

export type RevenueShareSummary = {
  orderVolume: number;
  platformFeesCollected: number;
  effectiveRatePercent: number;
  orderCount: number;
};

export function summarizeRevenueShare(
  orders: Array<{ total: number }>,
  feePercent: number,
  feeFixed: number
): RevenueShareSummary {
  let orderVolume = 0;
  let platformFeesCollected = 0;

  for (const order of orders) {
    const total = Number(order.total);
    orderVolume += total;
    platformFeesCollected += computePlatformFeeAmount({
      orderTotal: total,
      feePercent,
      feeFixed,
    });
  }

  orderVolume = Math.round(orderVolume * 100) / 100;
  platformFeesCollected = Math.round(platformFeesCollected * 100) / 100;

  const effectiveRatePercent =
    orderVolume > 0
      ? Math.round((platformFeesCollected / orderVolume) * 10000) / 100
      : feePercent;

  return {
    orderVolume,
    platformFeesCollected,
    effectiveRatePercent,
    orderCount: orders.length,
  };
}
