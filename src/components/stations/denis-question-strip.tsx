"use client";

import { useEffect, useRef, useState } from "react";
import { useStationQuestions } from "@/hooks/use-station-questions";
import { useDenisStationVoice } from "@/hooks/use-denis-station-voice";
import { resolveStationVoiceLine } from "@/components/stations/denis-station-voice-script";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { DenisVoicePresenceOrb } from "@/components/design-system/denis-voice-presence-orb";
import { resolveDenisMoodColor } from "@/components/design-system/denis-mood-color";
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

export type QuestionUrgency = "normal" | "urgent" | "critical";

/** A guest order still waiting this long is already a five-alarm fire, regardless of how fresh Denis's current re-ask is. */
const OVERDUE_SEVERITY_CAP_MINUTES = 30;

/** Pulls "... čeka 154 min ..." back out of the staff-facing message text (see buildStationQuestionMessage). */
export function extractWaitMinutes(message: string): number | null {
  const match = message.match(/(\d+)\s*min\b/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes : null;
}

/** 0 = just asked, 1 = about to expire — drives Denis's mark color continuously. */
export function resolveUrgencyRatio(
  askedAt: string,
  expiresAt: string,
  now: number,
  waitMinutes?: number | null
): number {
  const total = Date.parse(expiresAt) - Date.parse(askedAt);
  const timerRatio =
    !Number.isFinite(total) || total <= 0
      ? 0
      : Math.min(1, Math.max(0, (now - Date.parse(askedAt)) / total));

  if (waitMinutes == null || !Number.isFinite(waitMinutes)) return timerRatio;

  // Denis re-asking resets the short per-question timer, but an order that's
  // been waiting 154 minutes shouldn't look calm just because the question
  // itself is new — take whichever signal is more urgent.
  const overdueRatio = Math.min(
    1,
    Math.max(0, waitMinutes / OVERDUE_SEVERITY_CAP_MINUTES)
  );
  return Math.max(timerRatio, overdueRatio);
}

/** Guest is still waiting and the station hasn't answered — Denis gets more insistent, never rude. */
export function resolveUrgency(
  askedAt: string,
  expiresAt: string,
  now: number,
  waitMinutes?: number | null
): QuestionUrgency {
  const elapsedRatio = resolveUrgencyRatio(askedAt, expiresAt, now, waitMinutes);
  if (elapsedRatio >= 0.75) return "critical";
  if (elapsedRatio >= 0.4) return "urgent";
  return "normal";
}

const URGENCY_PREFIX: Record<QuestionUrgency, string> = {
  normal: "",
  urgent: "Asking again — ",
  critical: "Guest still waiting, urgent — ",
};

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
  const { speak, activate, voicePrimed, speaking } = useDenisStationVoice(locationId);
  const spokenTiersRef = useRef<Set<string>>(new Set());

  const active = questions[0] ?? null;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Speak once per (question, urgency tier) — never repeat the same line
  // on every clock tick.
  useEffect(() => {
    if (!active) return;
    const tier = resolveUrgency(
      active.asked_at,
      active.expires_at,
      now,
      extractWaitMinutes(active.message)
    );
    const key = `${active.id}:${tier}`;
    if (spokenTiersRef.current.has(key)) return;
    spokenTiersRef.current.add(key);
    const line = resolveStationVoiceLine(tier, active.message);
    if (line) speak(line);
  }, [active, now, speak]);

  const activateButton = voicePrimed ? null : (
    <button
      type="button"
      onClick={activate}
      className="min-h-11 rounded-full border border-orange-500/50 bg-orange-500/15 px-4 text-sm font-semibold text-orange-200 hover:bg-orange-500/25"
    >
      Aktiviraj Denisa 🔊
    </button>
  );

  if (!active) {
    return activateButton ? (
      <div className="flex justify-center">{activateButton}</div>
    ) : null;
  }

  const remaining = secondsLeft(active.expires_at, now);
  if (remaining <= 0) {
    return activateButton ? (
      <div className="flex justify-center">{activateButton}</div>
    ) : null;
  }

  const activeWaitMinutes = extractWaitMinutes(active.message);
  const urgencyRatio = resolveUrgencyRatio(
    active.asked_at,
    active.expires_at,
    now,
    activeWaitMinutes
  );
  const urgency = resolveUrgency(
    active.asked_at,
    active.expires_at,
    now,
    activeWaitMinutes
  );

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
    <div className="flex flex-col items-center gap-3">
      {activateButton}
      <DenisVoicePresenceOrb moodIntensity={urgencyRatio} speaking={speaking} />
      <div
        className="w-full rounded-xl border p-4 transition-colors duration-700"
        style={{
          borderColor: resolveDenisMoodColor(urgencyRatio, 0.4),
          backgroundColor: resolveDenisMoodColor(urgencyRatio, 0.1),
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DenisMarkBadge size="sm" moodIntensity={urgencyRatio} />
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-wide",
                urgency === "critical" ? "text-red-300" : "text-orange-300"
              )}
            >
              Denis asks
              {questions.length > 1 ? (
                <span className="ml-2 rounded-full bg-orange-500/25 px-2 py-0.5 text-[11px] font-semibold text-orange-200">
                  +{questions.length - 1} queued
                </span>
              ) : null}
            </p>
          </div>
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
          {URGENCY_PREFIX[urgency]}
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
                Ready
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
                Starting now
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
                Picked up
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAnswer("still_waiting")}
                className="min-h-12 flex-1 rounded-lg border border-red-500/50 bg-red-500/15 px-4 text-base font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
              >
                Still at pass
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
