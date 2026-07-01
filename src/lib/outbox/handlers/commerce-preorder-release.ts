import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Outbox handler — kitchen release signal for scheduled preorder (P3). */
export async function handleCommercePreorderRelease(
  payload: Record<string, unknown>
): Promise<void> {
  const preorderId =
    typeof payload.preorderId === "string" ? payload.preorderId : null;
  if (!preorderId) {
    logger.warn("commerce.preorder.release missing preorderId", { payload });
    return;
  }

  const admin = createAdminClient();
  const { releasePreorderKitchen } = await import(
    "@/lib/denis/commerce/persist-preorder"
  );
  const result = await releasePreorderKitchen(admin, preorderId);
  if (!result.ok) {
    logger.warn("commerce.preorder.release failed", {
      preorderId,
      reason: result.reason,
    });
  }
}
