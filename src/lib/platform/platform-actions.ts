"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit/log";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { retryDeadLetterQueueItem } from "@/lib/outbox/dead-letter-queue";
import {
  parseFeatureFlags,
  type PlatformFeature,
} from "@/lib/platform/feature-flags";
import { IMPERSONATE_COOKIE } from "@/lib/platform/impersonation-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { extendTrialEndDate, resolvePlanChangeDirection } from "@/lib/billing/invoicing";
import { loadActivePlans } from "@/lib/billing/plans";

export async function startImpersonation(orgId: string) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) return { error: "Organization not found." };

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });

  redirect("/dashboard/orders");
}

export async function impersonateOrgAction(formData: FormData) {
  const orgId = formData.get("orgId");
  if (typeof orgId !== "string" || !orgId) return;
  await startImpersonation(orgId);
}

export async function exitImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
  redirect("/platform/orgs");
}

export async function toggleOrgFeature(orgId: string, flag: PlatformFeature, enabled: boolean) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("feature_flags")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) return { error: "Organization not found." };

  const flags = parseFeatureFlags(
    (org as { feature_flags: unknown }).feature_flags as import("@/types/database").Json
  );
  flags[flag] = enabled;

  const { error } = await admin
    .from("organizations")
    .update({
      feature_flags: flags,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/platform/orgs/${orgId}`);
  revalidatePath("/platform/orgs");
  return { success: true };
}

export async function updateOrgPlanAction(orgId: string, planId: string) {
  const staff = await requirePlatformAdmin();
  const admin = createAdminClient();

  const [{ data: beforeOrg }, plans] = await Promise.all([
    admin.from("organizations").select("plan_id").eq("id", orgId).maybeSingle(),
    loadActivePlans(),
  ]);

  const { data: plan } = await admin
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) return { error: "Plan not found." };

  const direction = resolvePlanChangeDirection(
    (beforeOrg as { plan_id?: string | null } | null)?.plan_id ?? null,
    planId,
    plans
  );

  const { error } = await admin
    .from("organizations")
    .update({
      plan_id: planId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) return { error: error.message };

  await auditLog({
    orgId,
    userId: staff.user_id,
    action: "update",
    entityType: "subscription_plan",
    entityId: orgId,
    oldValue: beforeOrg ?? undefined,
    newValue: { plan_id: planId, direction },
  });

  revalidatePath(`/platform/orgs/${orgId}`);
  revalidatePath("/platform/orgs");
  revalidatePath("/platform/analytics");
  return { success: true, direction };
}

export async function extendOrgTrialAction(orgId: string, days: number) {
  const staff = await requirePlatformAdmin();
  if (!Number.isFinite(days) || days < 1 || days > 90) {
    return { error: "Trial extension must be between 1 and 90 days." };
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("trial_ends_at")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) return { error: "Organization not found." };

  const nextEndsAt = extendTrialEndDate(
    (org as { trial_ends_at: string | null }).trial_ends_at,
    days
  );

  const { error } = await admin
    .from("organizations")
    .update({
      trial_ends_at: nextEndsAt,
      subscription_status: "trialing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) return { error: error.message };

  await auditLog({
    orgId,
    userId: staff.user_id,
    action: "update",
    entityType: "trial_extension",
    entityId: orgId,
    oldValue: org,
    newValue: { trial_ends_at: nextEndsAt, days },
  });

  revalidatePath(`/platform/orgs/${orgId}`);
  revalidatePath("/platform/orgs");
  return { success: true, trialEndsAt: nextEndsAt };
}

export async function setDenisEnabledAction(orgId: string, enabled: boolean) {
  return toggleOrgFeature(orgId, "ai_concierge", enabled);
}

export async function retryDlqItemAction(dlqId: string) {
  const staff = await requirePlatformAdmin();
  const result = await retryDeadLetterQueueItem(dlqId, staff.user_id);
  if (result.error) return { error: result.error };

  revalidatePath("/platform");
  if (result.orgId) {
    revalidatePath(`/platform/orgs/${result.orgId}`);
  }
  revalidatePath("/platform/orgs");
  return { success: true };
}
