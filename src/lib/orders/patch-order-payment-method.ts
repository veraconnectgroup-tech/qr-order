import { resilientFetch } from "@/lib/fetch/resilient-fetch";
import type { StaffSelectablePaymentMethod } from "@/lib/payment-methods";

export async function patchOrderPaymentMethod(
  orderId: string,
  paymentMethod: StaffSelectablePaymentMethod
) {
  const { error } = await resilientFetch<{ data: unknown; error: string | null }>(
    `/api/orders/${orderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_method: paymentMethod }),
    }
  );

  if (error) {
    throw new Error(error);
  }
}
