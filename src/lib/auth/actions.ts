"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { scheduleFiskalyTssProvision } from "@/lib/fiscal/provision-tss";
import { sanitizeSlug } from "@/lib/security/sanitize";
import { zEmailNormalized, zSanitizedText } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: zEmailNormalized(),
  password: z.string().trim().min(6).max(128),
});

const signupSchema = z.object({
  restaurantName: zSanitizedText(200).pipe(z.string().min(2)),
  email: zEmailNormalized(),
  password: z.string().trim().min(8).max(128),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Invalid sign-in details." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard/orders");
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    restaurantName: formData.get("restaurantName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Please fill in all fields correctly." };
  }

  const { restaurantName, email, password } = parsed.data;
  const supabase = await createServerClient();
  const admin = createAdminClient();

  let slug = sanitizeSlug(restaurantName);
  if (!slug) {
    slug = `venue-${Date.now().toString(36).slice(-6)}`;
  }
  const { data: existing } = await admin
    .from("organizations")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { restaurant_name: restaurantName },
    },
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Registration failed." };
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: restaurantName,
      slug,
      email,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: "Could not create your organization." };
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  scheduleFiskalyTssProvision(org.id);

  const { data: location, error: locError } = await admin
    .from("locations")
    .insert({
      org_id: org.id,
      name: restaurantName,
      is_active: true,
      timezone: "Europe/Berlin",
    })
    .select("id")
    .single();

  if (locError || !location) {
    return { error: "Could not create your location." };
  }

  await admin
    .from("organizations")
    .update({
      onboarding_completed: false,
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .eq("id", org.id);

  await admin.from("categories").insert([
    {
      location_id: location.id,
      name: "Food",
      name_en: "Food",
      sort_order: 0,
      menu_section: "food",
    },
    {
      location_id: location.id,
      name: "Drinks",
      name_en: "Drinks",
      sort_order: 1,
      menu_section: "drinks",
    },
    {
      location_id: location.id,
      name: "Desserts",
      name_en: "Desserts",
      sort_order: 2,
      menu_section: "desserts",
    },
  ] as never);

  const { error: staffError } = await admin.from("staff").insert({
    user_id: authData.user.id,
    org_id: org.id,
    role: "owner",
    name: restaurantName,
    email,
  });

  if (staffError) {
    return { error: "Could not create your staff profile." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard/setup");
}

export async function logoutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
