"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveAdapterVersion,
  rejectAdapterVersion,
} from "@/lib/denis/integrations/review/adapter-review-workflow";

export async function approveAdapterVersionAction(
  approvalRequestId: string,
  reviewNotes: string
) {
  const staff = await requirePlatformAdmin();
  const admin = createAdminClient();

  const result = await approveAdapterVersion(admin, {
    approvalRequestId,
    staffId: staff.id,
    reviewNotes: reviewNotes.trim() || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/platform/integrations");
  revalidatePath(`/platform/integrations/${approvalRequestId}`);
  return { success: true };
}

export async function rejectAdapterVersionAction(
  approvalRequestId: string,
  reviewNotes: string
) {
  if (!reviewNotes.trim()) {
    return { error: "Review notes are required to reject an adapter version." };
  }

  const staff = await requirePlatformAdmin();
  const admin = createAdminClient();

  const result = await rejectAdapterVersion(admin, {
    approvalRequestId,
    staffId: staff.id,
    reviewNotes: reviewNotes.trim(),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/platform/integrations");
  revalidatePath(`/platform/integrations/${approvalRequestId}`);
  return { success: true };
}
