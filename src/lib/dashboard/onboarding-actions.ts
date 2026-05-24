"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { notifyNewOrgGoingLive } from "@/lib/platform/notify-new-org";
import {
  zOptionalSanitizedText,
  zSanitizedText,
} from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionError = { error: string };
type OwnerContext = {
  staff: Awaited<ReturnType<typeof requireStaff>>;
  locationId: string;
};

const venueSchema = z.object({
  orgName: zSanitizedText(200).pipe(z.string().min(2)),
  address: zOptionalSanitizedText(500),
  city: zOptionalSanitizedText(120),
  postalCode: zOptionalSanitizedText(20),
  timezone: zSanitizedText(80).pipe(z.string().min(1)),
  logoUrl: zOptionalSanitizedText(2000),
});

const productInputSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  price: z.coerce.number().positive(),
  categoryId: z.string().uuid(),
});

function requireOwnerOrManager() {
  return requireStaff().then((staff) => {
    if (!["owner", "manager"].includes(staff.role)) {
      return { error: "Not allowed." as const };
    }
    return { staff };
  });
}

async function getOwnerContext(): Promise<ActionError | OwnerContext> {
  const auth = await requireOwnerOrManager();
  if ("error" in auth) return { error: auth.error ?? "Not allowed." };
  const locationId = await getStaffLocationId(auth.staff);
  if (!locationId) return { error: "Location not found." };
  return { staff: auth.staff, locationId };
}

async function ensureDefaultZone(locationId: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("zones")
    .select("id")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data: zone, error } = await admin
    .from("zones")
    .insert({
      location_id: locationId,
      name: "Main",
      sort_order: 0,
    } as never)
    .select("id")
    .single();

  if (error || !zone) throw new Error(error?.message ?? "Could not create zone.");
  return (zone as { id: string }).id;
}

export async function saveOnboardingVenue(input: {
  orgName: string;
  address?: string;
  city?: string;
  postalCode?: string;
  timezone: string;
  logoUrl?: string;
}) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid venue details." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: orgError } = await admin
    .from("organizations")
    .update({
      name: parsed.data.orgName,
      logo_url: parsed.data.logoUrl || null,
      updated_at: now,
    })
    .eq("id", ctx.staff.org_id);

  if (orgError) return { error: orgError.message };

  const { error: locError } = await admin
    .from("locations")
    .update({
      name: parsed.data.orgName,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      postal_code: parsed.data.postalCode ?? null,
      timezone: parsed.data.timezone,
      updated_at: now,
    })
    .eq("id", ctx.locationId);

  if (locError) return { error: locError.message };

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveOnboardingProducts(
  products: Array<{ name: string; price: number; categoryId: string }>
) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const parsed = z.array(productInputSchema).min(1).max(5).safeParse(products);
  if (!parsed.success) return { error: "Add at least one product." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("location_id", ctx.locationId)
    .is("deleted_at", null);

  const existingIds = (existing ?? []).map((row) => (row as { id: string }).id);
  if (existingIds.length) {
    await admin
      .from("products")
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", existingIds);
  }

  const { error } = await admin.from("products").insert(
    parsed.data.map((item) => ({
      location_id: ctx.locationId,
      category_id: item.categoryId,
      name: item.name,
      price: item.price,
      is_available: true,
    })) as never
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function saveOnboardingTables(tableNames: string[]) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const names = tableNames
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!names.length) return { error: "Add at least one table." };

  const admin = createAdminClient();
  const zoneId = await ensureDefaultZone(ctx.locationId);

  const { data: existing } = await admin
    .from("tables")
    .select("id")
    .eq("location_id", ctx.locationId)
    .is("deleted_at", null);

  const existingIds = (existing ?? []).map((row) => (row as { id: string }).id);
  if (existingIds.length) {
    await admin
      .from("tables")
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", existingIds);
  }

  const { data: inserted, error } = await admin
    .from("tables")
    .insert(
      names.map((name) => ({
        location_id: ctx.locationId,
        zone_id: zoneId,
        name,
        seats: 4,
      })) as never
    )
    .select("id, name, qr_token")
    .returns<Array<{ id: string; name: string; qr_token: string }>>();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard");
  return { success: true, tables: inserted ?? [] };
}

export async function skipOnboardingPayment() {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("locations")
    .update({
      payment_online_enabled: false,
      payment_at_bar_enabled: true,
      payment_card_at_table_enabled: false,
      in_person_payment_location: "bar",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.locationId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  return { success: true };
}

export async function saveOnboardingFiscal(
  steuernummer: string,
  ustIdNr: string
) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      steuernummer: steuernummer.trim() || null,
      ust_id_nr: ustIdNr.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.staff.org_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/setup");
  return { success: true };
}

export async function completeOnboarding() {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [{ error: orgError }, { error: locError }] = await Promise.all([
    admin
      .from("organizations")
      .update({ onboarding_completed: true, updated_at: now })
      .eq("id", ctx.staff.org_id),
    admin
      .from("locations")
      .update({
        accepting_orders: true,
        is_active: true,
        updated_at: now,
      })
      .eq("id", ctx.locationId),
  ]);

  if (orgError) return { error: orgError.message };
  if (locError) return { error: locError.message };

  void notifyNewOrgGoingLive(ctx.staff.org_id, ctx.locationId).catch((error) => {
    logger.warn("Platform new-org notification failed", {
      orgId: ctx.staff.org_id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  revalidatePath("/", "layout");
  redirect("/dashboard/orders");
}
