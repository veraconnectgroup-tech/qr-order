/** Payment statuses that mean the guest/venue has settled the order. */
export function isPaidPaymentStatus(status: string): boolean {
  return status === "paid" || status === "pos_online";
}
