import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadSessionAllergyLabels(
  admin: SupabaseClient,
  sessionId: string | null | undefined
): Promise<string[]> {
  if (!sessionId) return [];

  const { data } = await admin
    .from("table_sessions")
    .select("guest_preferences")
    .eq("id", sessionId)
    .maybeSingle();

  const prefs = data?.guest_preferences;
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    return [];
  }

  const allergies = (prefs as { allergies?: unknown }).allergies;
  if (!Array.isArray(allergies)) return [];

  return allergies
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}
