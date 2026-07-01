"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";

export type StationQuestionAnswerInput = {
  answer: StationQuestionRow["answer"];
  etaMinutes?: number;
};

export function useStationQuestions(
  locationId: string,
  station: "kitchen" | "bar"
) {
  const [questions, setQuestions] = useState<StationQuestionRow[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const { play } = useSoundAlert();

  const fetchQuestions = useCallback(async () => {
    if (!locationId) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("station_questions")
      .select("*")
      .eq("location_id", locationId)
      .eq("station", station)
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("asked_at", { ascending: true });

    if (error) {
      console.error("Station questions fetch failed:", error.message);
      return;
    }

    const rows = (data ?? []) as StationQuestionRow[];
    setQuestions(rows);

    if (initializedRef.current) {
      const hasNew = rows.some((row) => !knownIdsRef.current.has(row.id));
      if (hasNew) {
        play(station === "kitchen" ? "kitchen-order" : "bar-order");
      }
    }
    knownIdsRef.current = new Set(rows.map((row) => row.id));
    initializedRef.current = true;
  }, [locationId, station, play]);

  useEffect(() => {
    if (!locationId) return;
    void fetchQuestions();
  }, [locationId, fetchQuestions]);

  usePostgresRealtime({
    channelName: `station-questions:${locationId}:${station}`,
    table: "station_questions",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchQuestions,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  const answerQuestion = useCallback(
    async (questionId: string, input: StationQuestionAnswerInput) => {
      // Optimistic remove — the card should vanish on tap.
      setQuestions((prev) => prev.filter((row) => row.id !== questionId));

      const response = await fetch(
        `/api/station-questions/${questionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer: input.answer,
            etaMinutes: input.etaMinutes,
          }),
        }
      );

      if (!response.ok && response.status !== 409) {
        await fetchQuestions();
        throw new Error("Answer failed");
      }
    },
    [fetchQuestions]
  );

  return { questions, answerQuestion, refetch: fetchQuestions };
}
