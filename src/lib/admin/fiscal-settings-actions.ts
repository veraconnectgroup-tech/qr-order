"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { requireAdmin } from "@/lib/auth/session";
import { zOptionalSanitizedText } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const fiscalFieldsSchema = z.object({
  steuernummer: zOptionalSanitizedText(50),
  ust_id_nr: zOptionalSanitizedText(20).refine(
    (val) => !val || /^DE\d{9}$/.test(val),
    { message: "USt-IdNr must be DE followed by 9 digits (e.g. DE123456789)." }
  ),
});

export async function updateOrgFiscalFields(formData: FormData) {
  const staff = await requireAdmin();

  const parsed = fiscalFieldsSchema.safeParse({
    steuernummer: formData.get("steuernummer") || undefined,
    ust_id_nr: formData.get("ust_id_nr") || undefined,
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid fiscal fields.";
    return { error: message };
  }

  const admin = createAdminClient();
  const { data: beforeOrg } = await admin
    .from("organizations")
    .select("steuernummer, ust_id_nr")
    .eq("id", staff.org_id)
    .single();

  const { error } = await admin
    .from("organizations")
    .update({
      steuernummer: parsed.data.steuernummer || null,
      ust_id_nr: parsed.data.ust_id_nr || null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", staff.org_id);

  if (error) return { error: error.message };

  await auditLog({
    orgId: staff.org_id,
    userId: staff.user_id,
    action: "update",
    entityType: "organization_fiscal",
    entityId: staff.org_id,
    oldValue: beforeOrg ?? undefined,
    newValue: parsed.data,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
