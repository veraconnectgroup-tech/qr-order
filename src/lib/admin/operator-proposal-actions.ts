"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import {
  listPendingOperatorProposals,
  reviewOperatorConfigProposal,
} from "@/lib/operator/config-proposals";
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
