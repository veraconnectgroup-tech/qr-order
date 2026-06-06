import type { SupabaseClient } from "@supabase/supabase-js";
import { getCircuitBreakerStatus } from "@/lib/resilience/circuit-breaker";
import { enqueueDenisOperatorWebhooks } from "@/lib/webhooks/enqueue-denis-operator-webhook";
import { logger } from "@/lib/logger";

export async function emitDenisMetricsDailyReady(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    insightDate: string;
    metrics: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId: input.orgId,
      event: "denis.metrics.daily_ready",
      aggregateId: `${input.orgId}:${input.insightDate}`,
      payload: {
        orgId: input.orgId,
        locationId: input.locationId,
        metrics: { ...input.metrics, insightDate: input.insightDate },
      },
    });
  } catch (error) {
    logger.warn("denis.metrics.daily_ready enqueue failed", {
      orgId: input.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisConversionDropAlert(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    addRate: number;
    insightDate: string;
  }
): Promise<void> {
  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId: input.orgId,
      event: "denis.alert.conversion_drop",
      aggregateId: `${input.locationId}:${input.insightDate}`,
      payload: {
        orgId: input.orgId,
        locationId: input.locationId,
        metrics: {
          addRate: input.addRate,
          insightDate: input.insightDate,
          threshold: 0.15,
        },
      },
    });
  } catch (error) {
    logger.warn("denis.alert.conversion_drop enqueue failed", {
      orgId: input.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisCreditLowAlert(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    balance: number;
    threshold: number;
    traceId?: string;
  }
): Promise<void> {
  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId: input.orgId,
      event: "denis.alert.credit_low",
      aggregateId: input.orgId,
      payload: {
        orgId: input.orgId,
        locationId: input.locationId,
        metrics: {
          balance: input.balance,
          threshold: input.threshold,
        },
        traceId: input.traceId,
      },
    });
  } catch (error) {
    logger.warn("denis.alert.credit_low enqueue failed", {
      orgId: input.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisCircuitOpenAlert(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    service: string;
  }
): Promise<void> {
  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId: input.orgId,
      event: "denis.alert.circuit_open",
      aggregateId: `${input.orgId}:${input.service}`,
      payload: {
        orgId: input.orgId,
        locationId: input.locationId,
        metrics: { service: input.service, circuit: "open" },
      },
    });
  } catch (error) {
    logger.warn("denis.alert.circuit_open enqueue failed", {
      orgId: input.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisCircuitAlertsForOrg(
  admin: SupabaseClient,
  orgId: string
): Promise<void> {
  const openai = await getCircuitBreakerStatus("openai");
  if (!openai.ok) {
    const { data: locations } = await admin
      .from("locations")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .limit(1);

    const locationId = (locations?.[0] as { id: string } | undefined)?.id;
    if (locationId) {
      await emitDenisCircuitOpenAlert(admin, {
        orgId,
        locationId,
        service: "openai",
      });
    }
  }
}
