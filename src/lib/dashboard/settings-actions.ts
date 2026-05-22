"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffLocationId, requireAdmin, requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const orgSettingsSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  description: z.string().optional(),
  default_tax_percent: z.coerce.number().min(0).max(100),
});

export async function updateOrganizationSettings(formData: FormData) {
  const staff = await requireAdmin();

  const parsed = orgSettingsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || undefined,
    description: formData.get("description") || undefined,
    default_tax_percent: formData.get("default_tax_percent"),
  });

  if (!parsed.success) {
    return { error: "Invalid settings." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description || null,
      default_tax_percent: parsed.data.default_tax_percent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staff.org_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function setLocationOrderingActive(active: boolean) {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Not allowed." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("locations")
    .update({
      accepting_orders: active,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true, active };
}

export async function updateLocationPaymentMethods(input: {
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
}) {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Not allowed." };
  }

  if (
    !input.paymentOnlineEnabled &&
    !input.paymentAtBarEnabled &&
    !input.paymentCardAtTableEnabled
  ) {
    return { error: "At least one payment method must stay enabled." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("locations")
    .update({
      payment_online_enabled: input.paymentOnlineEnabled,
      payment_at_bar_enabled: input.paymentAtBarEnabled,
      payment_card_at_table_enabled: input.paymentCardAtTableEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true };
}
