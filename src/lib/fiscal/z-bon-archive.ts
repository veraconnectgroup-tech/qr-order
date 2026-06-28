import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZBonDisplayData } from "@/lib/fiscal/daily-closing";
import { logger } from "@/lib/logger";

export const FISCAL_ARCHIVES_BUCKET = "fiscal-archives";

function archivePath(
  orgId: string,
  locationId: string,
  businessDate: string
): string {
  return `${orgId}/${locationId}/z-bons/${businessDate}.html`;
}

/**
 * Cloud backup for signed Z-Bon HTML (print-to-PDF ready).
 * Gracefully skips when the storage bucket is unavailable.
 */
export async function archiveZBonToCloud(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    businessDate: string;
    html: string;
    display: ZBonDisplayData;
  }
): Promise<{ archived: boolean; path?: string }> {
  const path = archivePath(input.orgId, input.locationId, input.businessDate);

  const { error } = await admin.storage
    .from(FISCAL_ARCHIVES_BUCKET)
    .upload(path, Buffer.from(input.html, "utf8"), {
      contentType: "text/html; charset=utf-8",
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    logger.warn("Z-Bon cloud archive skipped", {
      path,
      error: error.message,
      businessDate: input.businessDate,
    });
    return { archived: false };
  }

  logger.info("Z-Bon archived to cloud storage", {
    path,
    businessDate: input.businessDate,
    totalGross: input.display.totalGross,
  });

  return { archived: true, path };
}
