import { createHmac, randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import type { WebhookEvent } from "@/lib/webhooks/events";
import { createAdminClient } from "@/lib/supabase/admin";

const DISPATCH_TIMEOUT_MS = 5000;
const MAX_FAILURES = 10;

export type WebhookPayload = {
  id: string;
  event: WebhookEvent;
  created_at: string;
  data: Record<string, unknown>;
};

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function deliverWebhook(
  config: { id: string; url: string; secret: string; failure_count: number },
  payload: WebhookPayload
) {
  const admin = createAdminClient();
  const body = JSON.stringify(payload);
  const signature = signPayload(config.secret, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": payload.event,
        "X-Webhook-Id": payload.id,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    if (config.failure_count > 0) {
      await admin
        .from("webhook_configs")
        .update({ failure_count: 0 })
        .eq("id", config.id);
    }
  } catch (error) {
    const failures = config.failure_count + 1;
    const updates: Record<string, unknown> = { failure_count: failures };
    if (failures >= MAX_FAILURES) {
      updates.is_active = false;
      logger.warn("Webhook auto-disabled after failures", {
        webhookId: config.id,
        failures,
      });
    }

    await admin.from("webhook_configs").update(updates as never).eq("id", config.id);

    logger.error("Webhook delivery failed", {
      webhookId: config.id,
      event: payload.event,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function dispatchWebhook(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { data: configs } = await admin
    .from("webhook_configs")
    .select("id, url, secret, events, failure_count")
    .eq("org_id", orgId)
    .eq("is_active", true);

  const matching = (configs ?? []).filter((row) => {
    const cfg = row as { events: string[] };
    return cfg.events.includes(event);
  }) as Array<{
    id: string;
    url: string;
    secret: string;
    events: string[];
    failure_count: number;
  }>;

  if (!matching.length) return;

  const payload: WebhookPayload = {
    id: randomUUID(),
    event,
    created_at: new Date().toISOString(),
    data,
  };

  await Promise.allSettled(
    matching.map((cfg) => deliverWebhook(cfg, payload))
  );
}

/** Fire-and-forget — does not block the caller. */
export function dispatchOrgWebhook(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
) {
  void dispatchWebhook(orgId, event, data).catch((err) =>
    logger.error("Webhook dispatch error", {
      orgId,
      event,
      error: err instanceof Error ? err.message : String(err),
    })
  );
}

export async function sendTestWebhook(
  webhookId: string,
  orgId: string
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("webhook_configs")
    .select("id, url, secret, failure_count, events")
    .eq("id", webhookId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!config) return { error: "Webhook not found." };

  const cfg = config as {
    id: string;
    url: string;
    secret: string;
    failure_count: number;
    events: string[];
  };

  const payload: WebhookPayload = {
    id: randomUUID(),
    event: (cfg.events[0] ?? "order.created") as WebhookEvent,
    created_at: new Date().toISOString(),
    data: { test: true, message: "QR Order webhook test" },
  };

  await deliverWebhook(cfg, payload);
  return { ok: true };
}
