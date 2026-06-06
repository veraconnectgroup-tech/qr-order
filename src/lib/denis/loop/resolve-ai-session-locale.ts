import type { MenuLocale } from "@/lib/i18n/translations";
import { MENU_LOCALES } from "@/lib/i18n/translations";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedAiSessionLocale = {
  menuLocale: MenuLocale;
  isEnglish: boolean;
  language: string;
};

export function resolveLocaleFromLanguage(
  language: string | null | undefined,
  fallback: MenuLocale = "de"
): ResolvedAiSessionLocale {
  const raw = language?.trim() || fallback;
  const menuLocale = (
    MENU_LOCALES.includes(raw as MenuLocale) ? raw : fallback
  ) as MenuLocale;
  return {
    menuLocale,
    isEnglish: raw === "en",
    language: raw,
  };
}

/** Guest language from shared ai_session — same source as chat turn (Phase D). */
export async function loadAiSessionLocale(
  admin: SupabaseClient,
  aiSessionId: string,
  fallback: MenuLocale = "de"
): Promise<ResolvedAiSessionLocale> {
  const { data } = await admin
    .from("ai_sessions")
    .select("language")
    .eq("id", aiSessionId)
    .maybeSingle();

  const language = (data as { language?: string } | null)?.language;
  return resolveLocaleFromLanguage(language, fallback);
}
