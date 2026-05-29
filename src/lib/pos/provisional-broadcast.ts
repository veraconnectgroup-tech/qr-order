"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  POS_BROADCAST_EVENT,
  posChannelName,
  type PosBroadcastEvent,
  type ProvisionalOrderPayload,
} from "@/lib/pos/provisional-types";

const MAX_PAYLOAD_BYTES = 8_192;
const activePublishChannels = new Map<string, RealtimeChannel>();

function parseBroadcastPayload(raw: unknown): PosBroadcastEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const envelope = raw as { payload?: unknown };
  const inner = envelope.payload ?? raw;
  if (!inner || typeof inner !== "object") return null;
  const event = inner as PosBroadcastEvent;
  if (
    event.type === "provisional_order" ||
    event.type === "order_confirmed" ||
    event.type === "order_conflict"
  ) {
    return event;
  }
  return null;
}

async function requireStaffSession(
  supabase: SupabaseClient
): Promise<{ staffId: string; locationId: string | null } | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, location_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (staffError || !staff) return null;

  return { staffId: staff.id, locationId: staff.location_id };
}

function assertPayloadSize(event: PosBroadcastEvent): void {
  const bytes = new TextEncoder().encode(JSON.stringify(event)).length;
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new Error("POS broadcast payload too large");
  }
}

function assertLocationScope(
  event: PosBroadcastEvent,
  expectedLocationId: string,
  staffLocationId: string | null
): void {
  if (event.type === "provisional_order") {
    if (event.payload.locationId !== expectedLocationId) {
      throw new Error("POS broadcast location mismatch");
    }
    if (staffLocationId && staffLocationId !== expectedLocationId) {
      throw new Error("Staff not scoped to location");
    }
    return;
  }

  if (staffLocationId && staffLocationId !== expectedLocationId) {
    throw new Error("Staff not scoped to location");
  }
}

async function getOrCreatePublishChannel(
  supabase: SupabaseClient,
  locationId: string
): Promise<RealtimeChannel> {
  const key = posChannelName(locationId);
  const existing = activePublishChannels.get(key);
  if (existing) return existing;

  const channel = supabase.channel(key, {
    config: { broadcast: { ack: false, self: false } },
  });

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(err ?? new Error(`POS channel subscribe failed: ${status}`));
      }
    });
  });

  activePublishChannels.set(key, channel);
  return channel;
}

async function sendPosEvent(
  supabase: SupabaseClient,
  locationId: string,
  event: PosBroadcastEvent
): Promise<void> {
  const session = await requireStaffSession(supabase);
  if (!session) return;

  assertPayloadSize(event);
  assertLocationScope(event, locationId, session.locationId);

  const channel = await getOrCreatePublishChannel(supabase, locationId);
  const status = await channel.send({
    type: "broadcast",
    event: POS_BROADCAST_EVENT,
    payload: event,
  });

  if (status !== "ok") {
    console.warn("POS broadcast send status:", status);
  }
}

export async function broadcastProvisionalOrder(
  payload: ProvisionalOrderPayload,
  supabase: SupabaseClient = createClient()
): Promise<void> {
  await sendPosEvent(supabase, payload.locationId, {
    type: "provisional_order",
    payload,
  });
}

export async function broadcastOrderConfirmed(
  locationId: string,
  clientOrderId: string,
  orderId: string,
  orderNumber: number,
  supabase: SupabaseClient = createClient()
): Promise<void> {
  await sendPosEvent(supabase, locationId, {
    type: "order_confirmed",
    clientOrderId,
    orderId,
    orderNumber,
  });
}

export async function broadcastOrderConflict(
  locationId: string,
  clientOrderId: string,
  reason: string,
  supabase: SupabaseClient = createClient()
): Promise<void> {
  await sendPosEvent(supabase, locationId, {
    type: "order_conflict",
    clientOrderId,
    reason,
  });
}

export function subscribePosChannel(
  locationId: string,
  onEvent: (event: PosBroadcastEvent) => void,
  supabase: SupabaseClient = createClient()
): () => void {
  if (!locationId) return () => {};

  const channel = supabase.channel(posChannelName(locationId), {
    config: { broadcast: { self: false } },
  });

  channel.on(
    "broadcast",
    { event: POS_BROADCAST_EVENT },
    (message: { payload?: unknown }) => {
      const event = parseBroadcastPayload(message);
      if (!event) return;

      if (
        event.type === "provisional_order" &&
        event.payload.locationId !== locationId
      ) {
        return;
      }

      onEvent(event);
    }
  );

  channel.subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
