/**
 * ADR-052 §C steps 13-14 / §R Faza 5 — human review gate. This is the ONLY
 * path allowed to move an integration_adapter_version's status to
 * 'human_reviewed' or 'disabled' (rejected), and the only path allowed to
 * set integration_adapters.current_version_id. Callers must gate on
 * requirePlatformAdmin() themselves (this module is pure DB logic, same
 * split as bus-table-obligation.ts) — approve/reject never happens from
 * anywhere else, including the generator/repair-loop, which only ever
 * produce a 'sandbox_verified' (at best) version, never a reviewed one.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { logger } from "@/lib/logger";

export type IntegrationAdapterVersionRow =
  Database["public"]["Tables"]["integration_adapter_versions"]["Row"];
export type IntegrationApprovalRequestRow =
  Database["public"]["Tables"]["integration_approval_requests"]["Row"];
export type IntegrationAdapterRow =
  Database["public"]["Tables"]["integration_adapters"]["Row"];
export type IntegrationProviderRow =
  Database["public"]["Tables"]["integration_providers"]["Row"];
export type IntegrationCapabilityRow =
  Database["public"]["Tables"]["integration_capabilities"]["Row"];

export type PendingAdapterReview = {
  request: IntegrationApprovalRequestRow;
  version: IntegrationAdapterVersionRow;
  adapter: IntegrationAdapterRow;
  provider: IntegrationProviderRow;
};

/**
 * Only a version that already passed the sandbox/mock test suite may be
 * submitted for human review — the review step is meant to check
 * "does this look right and safe to activate", not "does this even run".
 */
export async function requestAdapterReview(
  admin: SupabaseClient,
  input: { adapterVersionId: string; requestedByStaffId: string | null }
): Promise<
  | { ok: true; request: IntegrationApprovalRequestRow }
  | { ok: false; error: "not_found" | "not_sandbox_verified" | "already_pending" | "insert_failed" }
> {
  const { data: versionRow } = await admin
    .from("integration_adapter_versions")
    .select("*")
    .eq("id", input.adapterVersionId)
    .maybeSingle();

  if (!versionRow) return { ok: false, error: "not_found" };
  const version = versionRow as IntegrationAdapterVersionRow;

  if (version.status !== "sandbox_verified") {
    return { ok: false, error: "not_sandbox_verified" };
  }

  const { data: existingPending } = await admin
    .from("integration_approval_requests")
    .select("id")
    .eq("adapter_version_id", input.adapterVersionId)
    .eq("decision", "pending")
    .maybeSingle();

  if (existingPending) return { ok: false, error: "already_pending" };

  const { data: inserted, error } = await admin
    .from("integration_approval_requests")
    .insert({
      adapter_version_id: input.adapterVersionId,
      requested_by_staff_id: input.requestedByStaffId,
      decision: "pending",
    })
    .select("*")
    .maybeSingle();

  if (error || !inserted) {
    logger.warn("requestAdapterReview insert failed", {
      adapterVersionId: input.adapterVersionId,
      error: error?.message,
    });
    return { ok: false, error: "insert_failed" };
  }

  return { ok: true, request: inserted as IntegrationApprovalRequestRow };
}

export async function listPendingAdapterReviews(
  admin: SupabaseClient
): Promise<PendingAdapterReview[]> {
  const { data: requestRows } = await admin
    .from("integration_approval_requests")
    .select("*")
    .eq("decision", "pending")
    .order("requested_at", { ascending: true });

  const requests = (requestRows ?? []) as IntegrationApprovalRequestRow[];
  if (!requests.length) return [];

  const versionIds = [...new Set(requests.map((r) => r.adapter_version_id))];
  const { data: versionRows } = await admin
    .from("integration_adapter_versions")
    .select("*")
    .in("id", versionIds);
  const versions = (versionRows ?? []) as IntegrationAdapterVersionRow[];
  const versionById = new Map(versions.map((v) => [v.id, v]));

  const adapterIds = [...new Set(versions.map((v) => v.adapter_id))];
  const { data: adapterRows } = adapterIds.length
    ? await admin.from("integration_adapters").select("*").in("id", adapterIds)
    : { data: [] as IntegrationAdapterRow[] };
  const adapters = (adapterRows ?? []) as IntegrationAdapterRow[];
  const adapterById = new Map(adapters.map((a) => [a.id, a]));

  const providerIds = [...new Set(adapters.map((a) => a.provider_id))];
  const { data: providerRows } = providerIds.length
    ? await admin.from("integration_providers").select("*").in("id", providerIds)
    : { data: [] as IntegrationProviderRow[] };
  const providers = (providerRows ?? []) as IntegrationProviderRow[];
  const providerById = new Map(providers.map((p) => [p.id, p]));

  const result: PendingAdapterReview[] = [];
  for (const request of requests) {
    const version = versionById.get(request.adapter_version_id);
    if (!version) continue;
    const adapter = adapterById.get(version.adapter_id);
    if (!adapter) continue;
    const provider = providerById.get(adapter.provider_id);
    if (!provider) continue;
    result.push({ request, version, adapter, provider });
  }
  return result;
}

export type AdapterReviewDetail = PendingAdapterReview & {
  capabilities: IntegrationCapabilityRow[];
};

export async function loadAdapterReviewDetail(
  admin: SupabaseClient,
  requestId: string
): Promise<AdapterReviewDetail | null> {
  const { data: requestRow } = await admin
    .from("integration_approval_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!requestRow) return null;
  const request = requestRow as IntegrationApprovalRequestRow;

  const { data: versionRow } = await admin
    .from("integration_adapter_versions")
    .select("*")
    .eq("id", request.adapter_version_id)
    .maybeSingle();
  if (!versionRow) return null;
  const version = versionRow as IntegrationAdapterVersionRow;

  const { data: adapterRow } = await admin
    .from("integration_adapters")
    .select("*")
    .eq("id", version.adapter_id)
    .maybeSingle();
  if (!adapterRow) return null;
  const adapter = adapterRow as IntegrationAdapterRow;

  const { data: providerRow } = await admin
    .from("integration_providers")
    .select("*")
    .eq("id", adapter.provider_id)
    .maybeSingle();
  if (!providerRow) return null;
  const provider = providerRow as IntegrationProviderRow;

  const { data: capabilityRows } = await admin
    .from("integration_capabilities")
    .select("*")
    .eq("provider_id", provider.id);
  const capabilities = (capabilityRows ?? []) as IntegrationCapabilityRow[];

  return { request, version, adapter, provider, capabilities };
}

async function markReviewDecision(
  admin: SupabaseClient,
  input: {
    approvalRequestId: string;
    staffId: string;
    reviewNotes: string | null;
    decision: "approved" | "rejected";
    versionStatus: "human_reviewed" | "disabled";
  }
): Promise<
  | { ok: true }
  | { ok: false; error: "not_found" | "not_pending" | "update_failed" }
> {
  const { data: requestRow } = await admin
    .from("integration_approval_requests")
    .select("*")
    .eq("id", input.approvalRequestId)
    .maybeSingle();

  if (!requestRow) return { ok: false, error: "not_found" };
  const request = requestRow as IntegrationApprovalRequestRow;
  if (request.decision !== "pending") return { ok: false, error: "not_pending" };

  const reviewedAt = new Date().toISOString();
  const { error: requestError } = await admin
    .from("integration_approval_requests")
    .update({
      decision: input.decision,
      reviewed_by_staff_id: input.staffId,
      reviewed_at: reviewedAt,
      review_notes: input.reviewNotes,
    })
    .eq("id", input.approvalRequestId)
    .eq("decision", "pending");

  if (requestError) {
    logger.warn("markReviewDecision request update failed", {
      approvalRequestId: input.approvalRequestId,
      error: requestError.message,
    });
    return { ok: false, error: "update_failed" };
  }

  const { data: versionRow, error: versionError } = await admin
    .from("integration_adapter_versions")
    .update({ status: input.versionStatus })
    .eq("id", request.adapter_version_id)
    .select("adapter_id")
    .maybeSingle();

  if (versionError || !versionRow) {
    logger.warn("markReviewDecision version update failed", {
      adapterVersionId: request.adapter_version_id,
      error: versionError?.message,
    });
    return { ok: false, error: "update_failed" };
  }

  if (input.decision === "approved") {
    const adapterId = (versionRow as { adapter_id: string }).adapter_id;
    const { error: adapterError } = await admin
      .from("integration_adapters")
      .update({ current_version_id: request.adapter_version_id })
      .eq("id", adapterId);

    if (adapterError) {
      logger.warn("markReviewDecision current_version_id update failed", {
        adapterId,
        error: adapterError.message,
      });
      return { ok: false, error: "update_failed" };
    }
  }

  return { ok: true };
}

export async function approveAdapterVersion(
  admin: SupabaseClient,
  input: { approvalRequestId: string; staffId: string; reviewNotes?: string | null }
) {
  return markReviewDecision(admin, {
    approvalRequestId: input.approvalRequestId,
    staffId: input.staffId,
    reviewNotes: input.reviewNotes ?? null,
    decision: "approved",
    versionStatus: "human_reviewed",
  });
}

export async function rejectAdapterVersion(
  admin: SupabaseClient,
  input: { approvalRequestId: string; staffId: string; reviewNotes: string }
) {
  return markReviewDecision(admin, {
    approvalRequestId: input.approvalRequestId,
    staffId: input.staffId,
    reviewNotes: input.reviewNotes,
    decision: "rejected",
    versionStatus: "disabled",
  });
}
