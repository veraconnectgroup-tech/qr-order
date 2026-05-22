"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  restaurantName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Neispravni podaci za prijavu." };
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
    return { error: "Popunite sva polja ispravno." };
  }

  const { restaurantName, email, password } = parsed.data;
  const supabase = await createServerClient();
  const admin = createAdminClient();

  let slug = slugify(restaurantName);
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
    return { error: authError?.message ?? "Registracija nije uspela." };
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
    return { error: "Kreiranje restorana nije uspelo." };
  }

  const { data: location, error: locError } = await admin
    .from("locations")
    .insert({
      org_id: org.id,
      name: restaurantName,
      is_active: true,
    })
    .select("id")
    .single();

  if (locError || !location) {
    return { error: "Kreiranje lokacije nije uspelo." };
  }

  const { error: staffError } = await admin.from("staff").insert({
    user_id: authData.user.id,
    org_id: org.id,
    role: "owner",
    name: restaurantName,
    email,
  });

  if (staffError) {
    return { error: "Kreiranje naloga osoblja nije uspelo." };
  }

  revalidatePath("/admin");
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
