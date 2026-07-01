"use client";

import { useEffect, useState } from "react";
import { useStationQuestions } from "@/hooks/use-station-questions";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import { cn } from "@/lib/utils";

const ETA_OPTIONS: Record<"kitchen" | "bar", number[]> = {
  kitchen: [2, 5, 10],
  bar: [1, 3, 5],
};

function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Denis question card strip — one card at a time, one-tap answers. */
export function DenisQuestionStrip({
  locationId,
  station,
}: {
  locationId: string;
  station: "kitchen" | "bar";
}) {
  const { questions, answerQuestion } = useStationQuestions(
    locationId,
    station
  );
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const active = questions[0] ?? null;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const remaining = secondsLeft(active.expires_at, now);
  if (remaining <= 0) return null;

  const handleAnswer = async (
    answer: NonNullable<StationQuestionRow["answer"]>,
    etaMinutes?: number
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await answerQuestion(active.id, { answer, etaMinutes });
    } catch {
      // Refetch already happened in the hook on failure.
    } finally {
      setBusy(false);
    }
  };

  const isEtaQuestion =
    active.question_type === "eta" || active.question_type === "mixed_conflict";

  return (
    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-300">
          Denis pita
          {questions.length > 1 ? (
            <span className="ml-2 rounded-full bg-orange-500/25 px-2 py-0.5 text-[11px] font-semibold text-orange-200">
              +{questions.length - 1} u redu
            </span>
          ) : null}
        </p>
        <span
          className={cn(
            "font-mono text-sm font-semibold",
            remaining <= 20 ? "text-red-300" : "text-orange-200"
          )}
        >
          {formatCountdown(remaining)}
        </span>
      </div>

      <p className="mt-2 text-lg font-semibold leading-snug text-orange-50">
        {active.message}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {isEtaQuestion ? (
          <>
            {ETA_OPTIONS[station].map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={busy}
                onClick={() => void handleAnswer("eta", minutes)}
                className="min-h-12 flex-1 rounded-lg bg-orange-500 px-4 text-base font-bold text-white hover:bg-orange-400 disabled:opacity-50"
              >
                {minutes} min
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("problem")}
              className="min-h-12 flex-1 rounded-lg border border-red-500/50 bg-red-500/15 px-4 text-base font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
            >
              Problem
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("ready")}
              className="min-h-12 flex-1 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 text-base font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Spremno
            </button>
          </>
        ) : active.question_type === "pending_accept" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("accepted")}
              className="min-h-12 flex-1 rounded-lg bg-orange-500 px-4 text-base font-bold text-white hover:bg-orange-400 disabled:opacity-50"
            >
              Kreće odmah
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("problem")}
              className="min-h-12 flex-1 rounded-lg border border-red-500/50 bg-red-500/15 px-4 text-base font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
            >
              Problem
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("picked_up")}
              className="min-h-12 flex-1 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 text-base font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Preuzeto
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer("still_waiting")}
              className="min-h-12 flex-1 rounded-lg border border-red-500/50 bg-red-500/15 px-4 text-base font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
            >
              Još čeka na prozoru
            </button>
          </>
        )}
      </div>
    </div>
  );
}
