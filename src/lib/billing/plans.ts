import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
  sort_order: number;
  is_active: boolean;
};

function parsePlanFeatures(features: Json): string[] {
  if (!Array.isArray(features)) return [];
  return features.filter((item): item is string => typeof item === "string");
}

export async function loadActivePlans(): Promise<PlanRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("plans")
    .select("id, name, price_cents, currency, interval, features, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return ((data ?? []) as Array<Omit<PlanRow, "features"> & { features: Json }>).map(
    (plan) => ({
      ...plan,
      features: parsePlanFeatures(plan.features),
    })
  );
}

export async function loadPlanById(planId: string): Promise<PlanRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("plans")
    .select("id, name, price_cents, currency, interval, features, sort_order, is_active")
    .eq("id", planId)
    .maybeSingle();

  if (!data) return null;
  const row = data as Omit<PlanRow, "features"> & { features: Json };
  return { ...row, features: parsePlanFeatures(row.features) };
}
