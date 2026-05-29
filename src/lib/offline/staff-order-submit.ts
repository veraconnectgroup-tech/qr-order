"use client";

import { broadcastProvisionalOrder } from "@/lib/pos/provisional-broadcast";
import { isPosKitchenProvisionalEnabled } from "@/lib/pos/feature-flags";
import type { ProvisionalOrderItem } from "@/lib/pos/provisional-types";
import { enqueueStaffOrder } from "@/lib/offline/order-queue";
import { syncQueuedStaffOrders } from "@/lib/offline/sync-manager";
import {
  computeStaffOrderTotals,
  type StaffCartLineInput,
} from "@/lib/tax/compute-staff-order-totals";
import { createClient } from "@/lib/supabase/client";

export type SubmitStaffOrderLocalFirstInput = {
  locationId: string;
  tableId: string;
  tableName: string;
  menuVersion: string;
  cartItems: Array<StaffCartLineInput & { productName: string }>;
  paymentMethod: string;
  orderNotes: string;
  isTakeaway: boolean;
  defaultTaxPercent: number;
  onClearForm: () => void;
  onOrderSaved?: (clientOrderId: string) => void;
  onKitchenBroadcast?: (clientOrderId: string) => void;
};

export type KitchenProvisionalEmitInput = {
  clientOrderId: string;
  locationId: string;
  tableId: string;
  tableName: string;
  items: ProvisionalOrderItem[];
  total: number;
  createdAt?: string;
};

async function resolveStaffIdForBroadcast(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  return staff?.id ?? null;
}

export type SubmitStaffOrderLocalFirstResult = {
  clientOrderId: string;
};

/** P1 — local-first WAL write, cart clear, background sync. No Denis / fiscal. */
export async function submitStaffOrderLocalFirst(
  input: SubmitStaffOrderLocalFirstInput
): Promise<SubmitStaffOrderLocalFirstResult> {
  if (input.cartItems.length === 0) {
    throw new Error("Cart is empty");
  }

  const clientOrderId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const clientSnapshot = computeStaffOrderTotals({
    cartItems: input.cartItems,
    isTakeaway: input.isTakeaway,
    orgDefaultRate: input.defaultTaxPercent,
  });

  const payload = {
    tableId: input.tableId,
    clientOrderId,
    menuVersion: input.menuVersion,
    clientSnapshot,
    items: input.cartItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      notes: item.notes || undefined,
      modifiers: item.modifiers.map((mod) => ({
        modifierId: mod.modifierId,
      })),
    })),
    paymentMethod: input.paymentMethod,
    notes: input.orderNotes.trim() || undefined,
    isTakeaway: input.isTakeaway,
  };

  await enqueueStaffOrder({
    id: clientOrderId,
    clientOrderId,
    locationId: input.locationId,
    createdAt,
    tableId: input.tableId,
    tableName: input.tableName,
    menuVersion: input.menuVersion,
    clientSnapshot,
    payload,
  });

  input.onOrderSaved?.(clientOrderId);
  input.onClearForm();

  void emitKitchenProvisionalIfEnabled({
    clientOrderId,
    locationId: input.locationId,
    tableId: input.tableId,
    tableName: input.tableName,
    items: input.cartItems.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      notes: item.notes || undefined,
    })),
    total: clientSnapshot.total,
    createdAt,
  }).then(() => {
    input.onKitchenBroadcast?.(clientOrderId);
  });

  void syncQueuedStaffOrders();

  return { clientOrderId };
}

/**
 * P2 — kitchen provisional broadcast after local WAL write.
 * No Denis / fiscal / server side effects.
 */
export async function emitKitchenProvisionalIfEnabled(
  input: KitchenProvisionalEmitInput
): Promise<void> {
  if (!isPosKitchenProvisionalEnabled(input.locationId)) return;

  const staffId = await resolveStaffIdForBroadcast();
  if (!staffId) return;

  try {
    await broadcastProvisionalOrder({
      clientOrderId: input.clientOrderId,
      locationId: input.locationId,
      tableId: input.tableId,
      tableName: input.tableName,
      staffId,
      items: input.items,
      total: input.total,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Kitchen provisional broadcast failed:", err);
  }
}
