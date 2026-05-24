import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type {
  CloudPrinterContext,
  OrderOutboxContext,
  PosIntegrationContext,
  WebhookContext,
} from "@/lib/outbox/types";

async function loadPosIntegration(
  admin: ReturnType<typeof createAdminClient>,
  locationId: string
): Promise<PosIntegrationContext | null> {
  const { data, error } = await admin
    .from("pos_integrations")
    .select("id, provider, status")
    .eq("location_id", locationId)
    .eq("status", "connected")
    .maybeSingle();

  if (error) {
    logger.warn("POS integration lookup failed", {
      locationId,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;

  const row = data as {
    id: string;
    provider: string;
    status: PosIntegrationContext["status"];
  };

  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
  };
}

async function loadActiveWebhooks(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<WebhookContext[]> {
  const { data, error } = await admin
    .from("webhook_configs")
    .select("id, url, events")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (error) {
    logger.warn("Webhook config lookup failed", {
      orgId,
      error: error.message,
    });
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const cfg = row as { events: string[] };
      return cfg.events.includes("order.created");
    })
    .map((row) => {
      const cfg = row as { id: string; url: string };
      return { id: cfg.id, url: cfg.url };
    });
}

function loadCloudPrinters(): CloudPrinterContext[] {
  // CloudPRNT (Track D) — server-side cloud printers not in schema yet.
  return [];
}

export async function loadOrderOutboxContext(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    orderId: string;
    locationId: string;
    orgId: string;
    orderNumber: number;
    tableName: string;
    total: number;
    paymentStatus: string;
    guestEmail?: string | null;
    orderSource?: string;
  }
): Promise<OrderOutboxContext> {
  const [posIntegration, activeWebhooks, cloudPrinters] = await Promise.all([
    loadPosIntegration(admin, input.locationId),
    loadActiveWebhooks(admin, input.orgId),
    Promise.resolve(loadCloudPrinters()),
  ]);

  return {
    orderId: input.orderId,
    locationId: input.locationId,
    orgId: input.orgId,
    orderNumber: input.orderNumber,
    tableName: input.tableName,
    total: input.total,
    paymentStatus: input.paymentStatus,
    guestEmail: input.guestEmail,
    orderSource: input.orderSource,
    posIntegration,
    cloudPrinters,
    activeWebhooks,
  };
}
