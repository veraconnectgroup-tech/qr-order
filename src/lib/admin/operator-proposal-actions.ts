"use server";

import { revalidatePath } from "next/cache";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  getOperatorConfigProposal,
  listPendingOperatorProposals,
  reviewOperatorConfigProposal,
} from "@/lib/operator/config-proposals";
import { parsePartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { setConfigShadow } from "@/lib/denis/config/config-shadow";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadPendingOperatorProposalsAction() {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  return listPendingOperatorProposals(admin, staff.org_id);
}

export async function reviewOperatorProposalAction(
  proposalId: string,
  decision: "approved" | "rejected"
) {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  const result = await reviewOperatorConfigProposal(admin, {
    orgId: staff.org_id,
    proposalId,
    decision,
    reviewedByStaffId: staff.id,
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function shadowTestOperatorProposalAction(proposalId: string) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "No location assigned." as const };

  const admin = createAdminClient();
  const proposal = await getOperatorConfigProposal(admin, {
    orgId: staff.org_id,
    proposalId,
  });

  if (!proposal) return { error: "Proposal not found." as const };
  if (proposal.status !== "pending") {
    return { error: "Proposal already reviewed." as const };
  }
  if (proposal.kind !== "config") {
    return { error: "Only config proposals support shadow test." as const };
  }
  if (proposal.locationId !== locationId) {
    return { error: "Proposal is for a different location." as const };
  }

  const patch = parsePartialConciergeConfig(proposal.patch);
  if (!patch) return { error: "Invalid config patch." as const };

  const shadow = await setConfigShadow(locationId, {
    patch,
    appliedBy: "operator-proposal",
    changeNote: proposal.reason,
  });

  if (!shadow) {
    return { error: "Shadow mode unavailable (Redis required)." as const };
  }

  revalidatePath("/admin/settings");
  return { success: true as const, shadow };
}
