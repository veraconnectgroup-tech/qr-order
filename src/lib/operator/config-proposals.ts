import type { SupabaseClient } from "@supabase/supabase-js";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import {
  parsePartialConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { enqueueDenisOperatorWebhooks } from "@/lib/webhooks/enqueue-denis-operator-webhook";
import { logger } from "@/lib/logger";

export type ProposalKind = "config" | "playbook";
export type ProposalStatus = "pending" | "approved" | "rejected";

export type OperatorConfigProposal = {
  id: string;
  orgId: string;
  locationId: string;
  kind: ProposalKind;
  patch: Record<string, unknown>;
  reason: string;
  status: ProposalStatus;
  createdByKeyId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export async function createOperatorConfigProposal(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    kind: ProposalKind;
    patch: Record<string, unknown>;
    reason: string;
    createdByKeyId: string;
  }
): Promise<OperatorConfigProposal | null> {
  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("id", input.locationId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!location) return null;

  if (input.kind === "config") {
    const parsed = parsePartialConciergeConfig(input.patch);
    if (!parsed) return null;
  }

  const { data, error } = await admin
    .from("operator_config_proposals")
    .insert({
      org_id: input.orgId,
      location_id: input.locationId,
      kind: input.kind,
      patch: input.patch,
      reason: input.reason,
      created_by_key_id: input.createdByKeyId,
      status: "pending",
    } as never)
    .select(
      "id, org_id, location_id, kind, patch, reason, status, created_by_key_id, created_at, reviewed_at"
    )
    .single();

  if (error || !data) {
    logger.error("operator config proposal insert failed", { error: error?.message });
    return null;
  }

  const row = data as {
    id: string;
    org_id: string;
    location_id: string;
    kind: ProposalKind;
    patch: Record<string, unknown>;
    reason: string;
    status: ProposalStatus;
    created_by_key_id: string | null;
    created_at: string;
    reviewed_at: string | null;
  };

  const proposal = mapProposalRow(row);

  try {
    await enqueueDenisOperatorWebhooks(admin, {
      orgId: input.orgId,
      event: "denis.config.proposal.created",
      aggregateId: proposal.id,
      payload: {
        orgId: input.orgId,
        locationId: input.locationId,
        proposalId: proposal.id,
        metrics: { kind: input.kind },
        traceId: proposal.id,
      },
    });
  } catch (webhookError) {
    logger.warn("denis.config.proposal.created enqueue failed", {
      proposalId: proposal.id,
      error:
        webhookError instanceof Error ? webhookError.message : String(webhookError),
    });
  }

  return proposal;
}

export async function getOperatorConfigProposal(
  admin: SupabaseClient,
  input: { orgId: string; proposalId: string }
): Promise<OperatorConfigProposal | null> {
  const { data } = await admin
    .from("operator_config_proposals")
    .select(
      "id, org_id, location_id, kind, patch, reason, status, created_by_key_id, created_at, reviewed_at"
    )
    .eq("id", input.proposalId)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!data) return null;
  return mapProposalRow(data as never);
}

export async function listPendingOperatorProposals(
  admin: SupabaseClient,
  orgId: string
): Promise<OperatorConfigProposal[]> {
  const { data } = await admin
    .from("operator_config_proposals")
    .select(
      "id, org_id, location_id, kind, patch, reason, status, created_by_key_id, created_at, reviewed_at"
    )
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return ((data ?? []) as never[]).map((row) => mapProposalRow(row));
}

export async function reviewOperatorConfigProposal(
  admin: SupabaseClient,
  input: {
    orgId: string;
    proposalId: string;
    decision: "approved" | "rejected";
    reviewedByStaffId: string;
  }
): Promise<{ ok: true } | { error: string }> {
  const proposal = await getOperatorConfigProposal(admin, {
    orgId: input.orgId,
    proposalId: input.proposalId,
  });

  if (!proposal) return { error: "Proposal not found." };
  if (proposal.status !== "pending") {
    return { error: "Proposal already reviewed." };
  }

  if (input.decision === "rejected") {
    await admin
      .from("operator_config_proposals")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: input.reviewedByStaffId,
      } as never)
      .eq("id", proposal.id);
    return { ok: true };
  }

  if (proposal.kind === "config") {
    const patch = parsePartialConciergeConfig(proposal.patch);
    if (!patch) return { error: "Invalid config patch." };

    const { data: locationRow } = await admin
      .from("locations")
      .select("ai_concierge_config")
      .eq("id", proposal.locationId)
      .eq("org_id", input.orgId)
      .maybeSingle();

    const current = parsePartialConciergeConfig(
      (locationRow as { ai_concierge_config?: unknown } | null)
        ?.ai_concierge_config
    );
    const merged = mergePartialConciergeConfig(current, patch);

    await admin
      .from("locations")
      .update({ ai_concierge_config: merged as never })
      .eq("id", proposal.locationId)
      .eq("org_id", input.orgId);

    await admin.from("config_change_log").insert({
      org_id: input.orgId,
      location_id: proposal.locationId,
      changed_by: "operator_proposal",
      config_path: "ai_concierge_config",
      old_value: (current ?? {}) as never,
      new_value: merged as never,
      reason: proposal.reason,
      proposal_id: proposal.id,
    } as never);

    await invalidateConciergeConfigCache(proposal.locationId);
  } else {
    const examples = (proposal.patch as { examples?: unknown }).examples;
    if (!Array.isArray(examples)) {
      return { error: "Invalid playbook proposal." };
    }

    for (const [index, example] of examples.entries()) {
      const row = example as {
        category?: string;
        user_message?: string;
        assistant_message?: string;
      };
      if (!row.user_message || !row.assistant_message) continue;

      await admin.from("ai_examples").insert({
        org_id: input.orgId,
        location_id: proposal.locationId,
        category: row.category ?? "general",
        user_message: row.user_message,
        assistant_message: row.assistant_message,
        sort_order: index,
        is_active: true,
      } as never);
    }

    await admin.from("config_change_log").insert({
      org_id: input.orgId,
      location_id: proposal.locationId,
      changed_by: "operator_proposal",
      config_path: "ai_examples",
      new_value: proposal.patch as never,
      reason: proposal.reason,
      proposal_id: proposal.id,
    } as never);
  }

  await admin
    .from("operator_config_proposals")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.reviewedByStaffId,
    } as never)
    .eq("id", proposal.id);

  return { ok: true };
}

function mapProposalRow(row: {
  id: string;
  org_id: string;
  location_id: string;
  kind: ProposalKind;
  patch: Record<string, unknown>;
  reason: string;
  status: ProposalStatus;
  created_by_key_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}): OperatorConfigProposal {
  return {
    id: row.id,
    orgId: row.org_id,
    locationId: row.location_id,
    kind: row.kind,
    patch: row.patch,
    reason: row.reason,
    status: row.status,
    createdByKeyId: row.created_by_key_id,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export function parseConfigProposalBody(body: unknown): {
  locationId: string;
  patch: PartialConciergeConfig;
  reason: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as {
    locationId?: string;
    patch?: unknown;
    reason?: string;
  };
  if (!raw.locationId || !raw.reason?.trim()) return null;
  const patch = parsePartialConciergeConfig(raw.patch);
  if (!patch) return null;
  return {
    locationId: raw.locationId,
    patch,
    reason: raw.reason.trim(),
  };
}

export function parsePlaybookProposalBody(body: unknown): {
  locationId: string;
  examples: Array<Record<string, unknown>>;
  reason: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as {
    locationId?: string;
    examples?: unknown;
    reason?: string;
  };
  if (!raw.locationId || !raw.reason?.trim() || !Array.isArray(raw.examples)) {
    return null;
  }
  return {
    locationId: raw.locationId,
    examples: raw.examples as Array<Record<string, unknown>>,
    reason: raw.reason.trim(),
  };
}
