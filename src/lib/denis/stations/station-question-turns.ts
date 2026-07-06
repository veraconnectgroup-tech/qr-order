import type { StationVoiceTurn } from "@/lib/denis/stations/station-voice-context";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StationQuestionTurnRow =
  Database["public"]["Tables"]["station_question_turns"]["Row"];

const MAX_TURNS = 24;
const MAX_TEXT = 2000;

/** Load prior voice turns for a station question (oldest first). */
export async function listStationQuestionTurns(
  admin: SupabaseClient,
  questionId: string
): Promise<StationVoiceTurn[]> {
  const { data, error } = await admin
    .from("station_question_turns")
    .select("role, text")
    .eq("station_question_id", questionId)
    .order("created_at", { ascending: true })
    .limit(MAX_TURNS);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    role: row.role as StationVoiceTurn["role"],
    text: row.text,
  }));
}

/** Append one Denis or staff utterance — never deleted when question closes. */
export async function appendStationQuestionTurn(
  admin: SupabaseClient,
  questionId: string,
  role: StationVoiceTurn["role"],
  text: string
): Promise<void> {
  const trimmed = text.trim().slice(0, MAX_TEXT);
  if (!trimmed) return;

  const { error } = await admin.from("station_question_turns").insert({
    station_question_id: questionId,
    role,
    text: trimmed,
  });

  if (error) throw error;
}
