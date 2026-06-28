"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { requireOwner } from "@/lib/auth/session";
import {
  bulkUpdateProductPrice,
  type BulkPriceUpdateMode,
} from "@/lib/menu-sync/bulk-price-update";
import { copyMenuBetweenLocations } from "@/lib/menu-sync/copy-menu";
import { createAdminClient } from "@/lib/supabase/admin";
import { zUuid } from "@/lib/security/zod-fields";

const copySchema = z.object({
  sourceLocationId: zUuid(),
  targetLocationId: zUuid(),
  replaceExisting: z.boolean().optional(),
});

const bulkPriceSchema = z.object({
  productNameMatch: z.string().min(1).max(120),
  locationIds: z.array(zUuid()).min(1),
  mode: z.enum(["set", "increase_percent", "increase_amount"]),
  value: z.number().finite(),
});

export async function copyMenuAction(input: {
  sourceLocationId: string;
  targetLocationId: string;
  replaceExisting?: boolean;
}) {
  const staff = await requireOwner();
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid menu copy request." };
  }

  const admin = createAdminClient();

  try {
    const result = await copyMenuBetweenLocations(admin, {
      orgId: staff.org_id,
      sourceLocationId: parsed.data.sourceLocationId,
      targetLocationId: parsed.data.targetLocationId,
      replaceExisting: parsed.data.replaceExisting ?? false,
    });

    await auditLog({
      orgId: staff.org_id,
      userId: staff.user_id,
      action: "create",
      entityType: "menu_copy",
      newValue: {
        sourceLocationId: parsed.data.sourceLocationId,
        targetLocationId: parsed.data.targetLocationId,
        ...result,
      },
    });

    revalidatePath("/admin/menu");
    revalidatePath("/admin/locations");
    return { data: result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Menu copy failed.",
    };
  }
}

export async function bulkPriceUpdateAction(input: {
  productNameMatch: string;
  locationIds: string[];
  mode: BulkPriceUpdateMode;
  value: number;
}) {
  const staff = await requireOwner();
  const parsed = bulkPriceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid bulk price update." };
  }

  const admin = createAdminClient();

  try {
    const result = await bulkUpdateProductPrice(admin, {
      orgId: staff.org_id,
      ...parsed.data,
    });

    await auditLog({
      orgId: staff.org_id,
      userId: staff.user_id,
      action: "update",
      entityType: "menu_bulk_price",
      newValue: { ...parsed.data, ...result },
    });

    revalidatePath("/admin/menu");
    return { data: result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Bulk price update failed.",
    };
  }
}
