"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { retryDeadLetterQueueItem } from "@/lib/outbox/dead-letter-queue";

export async function retryAdminDlqItemAction(dlqId: string) {
  const staff = await requireAdmin();
  const result = await retryDeadLetterQueueItem(dlqId, staff.user_id);
  if (result.error) return { error: result.error };

  revalidatePath("/admin/audit-log");
  return { success: true };
}
