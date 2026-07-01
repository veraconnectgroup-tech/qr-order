import type { SupabaseClient } from "@supabase/supabase-js";
import {
  estimatePreorderPrepMinutes,
  type PreorderCartLine,
  type PreorderRequest,
  type PreorderStatus,
  shouldCancelPreorderForNoShow,
  validatePreorder,
  buildPreorderConfirmationMessage,
} from "@/lib/denis/commerce/preorder-flow";
import { schedulePreorderJobs } from "@/lib/denis/commerce/schedule-preorder-jobs";

type LocationRow = {
  org_id: string;
  operating_hours: unknown;
};

type OpeningHours = {
  open?: string;
  close?: string;
};

function resolveVenueHours(raw: unknown): { open: string; close: string } {
  if (raw && typeof raw === "object") {
    const record = raw as OpeningHours;
    if (record.open && record.close) {
      return { open: record.open, close: record.close };
    }
  }
  return { open: "10:00", close: "23:00" };
}

export type PersistPreorderInput = {
  request: PreorderRequest;
  unavailableProductIds: string[];
  prepTimeEstimateMinutes?: number;
  idempotencyKey: string;
  nowMs?: number;
};

export type PersistPreorderResult =
  | {
      ok: true;
      preorderId: string;
      kitchenReleaseAt: string;
      noShowCancelAt: string;
      confirmationMessage: string;
    }
  | { ok: false; errors: string[] };

export async function persistScheduledPreorder(
  admin: SupabaseClient,
  input: PersistPreorderInput
): Promise<PersistPreorderResult> {
  const { data: location } = await admin
    .from("locations")
    .select("org_id, operating_hours")
    .eq("id", input.request.locationId)
    .maybeSingle();

  if (!location) {
    return { ok: false, errors: ["location_not_found"] };
  }

  const locationRow = location as LocationRow;
  const prepTime = estimatePreorderPrepMinutes(
    input.request.items,
    input.prepTimeEstimateMinutes ?? 0
  );

  const validation = validatePreorder({
    request: input.request,
    venueHours: resolveVenueHours(locationRow.operating_hours),
    unavailableProducts: input.unavailableProductIds,
    prepTimeEstimate: prepTime,
    now: input.nowMs,
  });

  if (!validation.valid || !validation.kitchenReleaseAt || !validation.noShowCancelAt) {
    return { ok: false, errors: validation.errors };
  }

  const items: PreorderCartLine[] = input.request.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    menuSection: item.menuSection ?? null,
    notes: item.notes ?? "",
  }));

  const { data: inserted, error } = await admin
    .from("commerce_preorders" as never)
    .insert({
      org_id: locationRow.org_id,
      location_id: input.request.locationId,
      table_id: input.request.tableId,
      guest_id: input.request.guestId,
      items,
      scheduled_for: input.request.scheduledFor,
      kitchen_release_at: validation.kitchenReleaseAt,
      no_show_cancel_at: validation.noShowCancelAt,
      note: input.request.note,
      payment_method: input.request.paymentMethod,
      status: "confirmed",
      prep_time_minutes: prepTime,
      idempotency_key: input.idempotencyKey,
    } as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, errors: ["duplicate_preorder"] };
    }
    return { ok: false, errors: [error.message] };
  }

  const preorderId = (inserted as { id: string }).id;

  await schedulePreorderJobs({
    preorderId,
    kitchenReleaseAt: validation.kitchenReleaseAt,
    noShowCancelAt: validation.noShowCancelAt,
    nowMs: input.nowMs,
  });

  return {
    ok: true,
    preorderId,
    kitchenReleaseAt: validation.kitchenReleaseAt,
    noShowCancelAt: validation.noShowCancelAt,
    confirmationMessage: buildPreorderConfirmationMessage({
      items: input.request.items,
      scheduledFor: input.request.scheduledFor,
      prepTimeEstimateMinutes: prepTime,
    }),
  };
}

export async function releasePreorderKitchen(
  admin: SupabaseClient,
  preorderId: string
): Promise<{ ok: boolean; reason?: string }> {
  const { data: row } = await admin
    .from("commerce_preorders" as never)
    .select("id, status, location_id, session_id, items")
    .eq("id", preorderId)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };

  const preorder = row as {
    id: string;
    status: string;
    location_id: string;
    session_id: string | null;
  };

  if (preorder.status === "cancelled") {
    return { ok: false, reason: "cancelled" };
  }
  if (preorder.status === "preparing" || preorder.status === "ready") {
    return { ok: true };
  }

  const { error } = await admin
    .from("commerce_preorders" as never)
    .update({
      status: "preparing",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", preorderId)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    return { ok: false, reason: error.message };
  }

  if (preorder.session_id) {
    const { enqueueOutboxEvents } = await import("@/lib/outbox/enqueue-events");
    await enqueueOutboxEvents(admin, [
      {
        aggregate_type: "session",
        aggregate_id: preorder.session_id,
        domain: "commerce",
        event_type: "commerce.preorder.release",
        payload: { preorderId, sessionId: preorder.session_id },
      },
    ]);
  }

  return { ok: true };
}

export async function cancelPreorderNoShow(
  admin: SupabaseClient,
  preorderId: string
): Promise<{ ok: boolean; reason?: string }> {
  const { data: row } = await admin
    .from("commerce_preorders" as never)
    .select("id, status, session_id")
    .eq("id", preorderId)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };

  const preorder = row as {
    id: string;
    status: string;
    session_id: string | null;
  };

  if (preorder.session_id) {
    return { ok: true, reason: "guest_arrived" };
  }

  if (preorder.status === "cancelled") {
    return { ok: true };
  }

  if (preorder.status === "preparing" || preorder.status === "ready") {
    return { ok: true, reason: "already_in_kitchen" };
  }

  if (
    !shouldCancelPreorderForNoShow({
      status: preorder.status as PreorderStatus,
      sessionId: preorder.session_id,
    })
  ) {
    return { ok: true, reason: "not_cancellable" };
  }

  const { error } = await admin
    .from("commerce_preorders" as never)
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", preorderId)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}
