"use client";

import { resilientFetch } from "@/lib/fetch/resilient-fetch";
import type { StaffOrderQueuePayload } from "@/lib/offline/order-queue";

export type StaffOrderApiSuccess = {
  orderId: string;
  orderNumber: number;
  tableName: string;
  total: number;
  idempotent?: boolean;
};

export type PostStaffOrderApiResult =
  | { ok: true; data: StaffOrderApiSuccess }
  | {
      ok: false;
      error: string;
      status?: number;
      retried: boolean;
      unavailableProducts?: string[];
    };

type StaffOrderApiResponse = {
  data: StaffOrderApiSuccess | null;
  error: string | null;
  details?: { products?: string[] };
  products?: string[];
};

/** POST staff order payload — shared by sync manager and online local-first submit. */
export async function postStaffOrderApi(
  payload: StaffOrderQueuePayload
): Promise<PostStaffOrderApiResult> {
  const { data: body, error, status, retried } =
    await resilientFetch<StaffOrderApiResponse>("/api/staff-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const responseError =
    error ??
    (body && "error" in body ? (body as { error: string | null }).error : null);

  if (
    status === 400 &&
    (responseError === "unavailable_products" ||
      body?.error === "unavailable_products")
  ) {
    const products =
      body?.details?.products ??
      (body && "products" in body
        ? (body as { products?: string[] }).products
        : undefined);
    return {
      ok: false,
      error: responseError ?? "unavailable_products",
      status,
      retried,
      unavailableProducts: products,
    };
  }

  if (responseError || !body?.data) {
    return {
      ok: false,
      error: responseError ?? `Sync failed (${status ?? "?"})`,
      status,
      retried,
    };
  }

  return { ok: true, data: body.data };
}
