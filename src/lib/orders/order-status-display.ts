const STATUS_STEP: Record<string, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  delivered: 4,
};

export function orderStatusStepIndex(status: string) {
  if (status === "rejected" || status === "cancelled") return -1;
  return STATUS_STEP[status] ?? 0;
}

export function orderStatusHeadline(status: string, paymentStatus: string) {
  if (status === "rejected") return "Order rejected";
  if (status === "cancelled") return "Order cancelled";
  if (paymentStatus === "paid") {
    if (status === "delivered") return "Enjoy your order!";
    if (status === "ready") return "Ready for pickup";
    return "Payment received";
  }
  switch (status) {
    case "pending":
      return "Order received";
    case "accepted":
      return "Kitchen accepted your order";
    case "preparing":
      return "Being prepared";
    case "ready":
      return "Ready — coming to your table";
    case "delivered":
      return "Delivered";
    default:
      return "Order placed";
  }
}
