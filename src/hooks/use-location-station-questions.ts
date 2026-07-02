"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";

/** Open Denis station questions for a location (kitchen + bar). */
export function useLocationStationQuestions(locationId: string) {
  const [questions, setQuestions] = useState<StationQuestionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = useCallback(async () => {
    if (!locationId) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("station_questions")
      .select("*")
      .eq("location_id", locationId)
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });

    if (error) {
      console.error("Location station questions fetch failed:", error.message);
      setLoading(false);
      return;
    }

    setQuestions((data ?? []) as StationQuestionRow[]);
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  usePostgresRealtime({
    channelName: `station-questions:${locationId}:all`,
    table: "station_questions",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchQuestions,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  return { questions, loading, refetch: fetchQuestions };
}
