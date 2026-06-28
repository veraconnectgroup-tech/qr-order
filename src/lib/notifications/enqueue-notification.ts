import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import type { SupabaseClient } from "@supabase/supabase-js";

type EnqueueSmsInput = {
  locationId: string;
  phone: string;
  body: string;
  templateId: string;
  deviceFingerprint?: string;
};

export async function enqueueSmsNotification(
  admin: SupabaseClient,
  input: EnqueueSmsInput
): Promise<void> {
  await enqueueOutboxEvents(admin, [
    {
      aggregate_type: "session",
      aggregate_id: input.deviceFingerprint ?? input.phone,
      domain: "commerce",
      event_type: "notification.sms.send",
      payload: {
        locationId: input.locationId,
        phone: input.phone,
        body: input.body,
        templateId: input.templateId,
      },
    },
  ]);
}

export async function enqueueWhatsAppNotification(
  admin: SupabaseClient,
  input: EnqueueSmsInput
): Promise<void> {
  await enqueueOutboxEvents(admin, [
    {
      aggregate_type: "session",
      aggregate_id: input.deviceFingerprint ?? input.phone,
      domain: "commerce",
      event_type: "notification.whatsapp.send",
      payload: {
        locationId: input.locationId,
        phone: input.phone,
        body: input.body,
        templateId: input.templateId,
      },
    },
  ]);
}
