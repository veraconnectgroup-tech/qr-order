"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStationQuestions } from "@/hooks/use-station-questions";
import { useDenisStationVoice } from "@/hooks/use-denis-station-voice";
import { resolveStationVoiceLine } from "@/components/stations/denis-station-voice-script";
import { classifyStationVoiceReply } from "@/lib/denis/stations/classify-station-voice-reply";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import { DenisVoicePresenceOrb } from "@/components/design-system/denis-voice-presence-orb";

function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
}

export type QuestionUrgency = "normal" | "urgent" | "critical";

/** How many times Denis re-asks for a clarification before giving up on this listen window. */
const MAX_CLARIFY_RETRIES = 2;
const CLARIFY_LINE = "Nisam razumeo, možete li ponoviti?";

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

/**
 * Denis's voice presence — just the orb, full-screen and blurred behind,
 * while he has an unanswered question. Answering happens by voice
 * (walkie-talkie style, see useDenisStationVoice); the question text itself
 * lives in the station's normal alert/notification surfaces, not duplicated
 * here.
 */
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
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const { speak, activate, voicePrimed, speaking, listen } =
    useDenisStationVoice(locationId);
  const spokenTiersRef = useRef<Set<string>>(new Set());

  const active = questions[0] ?? null;
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active]);

  const handleAnswer = useCallback(
    async (
      answer: NonNullable<StationQuestionRow["answer"]>,
      etaMinutes?: number
    ) => {
      if (!active || busy) return;
      setBusy(true);
      try {
        await answerQuestion(active.id, { answer, etaMinutes });
      } catch {
        // Refetch already happened in the hook on failure.
      } finally {
        setBusy(false);
      }
    },
    [active, busy, answerQuestion]
  );

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Speak once per (question, urgency tier) — never repeat the same line
  // on every clock tick. Right after Denis finishes asking, open a short
  // listen window so staff can just answer out loud instead of tapping.
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
    if (!line) return;
    const questionId = active.id;
    const questionType = active.question_type;

    // Short back-and-forth: if Denis can't make sense of the reply, he asks
    // once more (up to MAX_CLARIFY_RETRIES) instead of silently giving up
    // after a single unrecognized answer.
    const attemptListen = (retriesLeft: number) => {
      listen((transcript) => {
        if (activeIdRef.current !== questionId) return;
        const reply = classifyStationVoiceReply(transcript, questionType);
        if (reply) {
          void handleAnswer(reply.answer, reply.etaMinutes).then(() => {
            spokenTiersRef.current.add(`${questionId}:answered`);
          });
          return;
        }
        if (retriesLeft <= 0) return;
        speak(CLARIFY_LINE, () => {
          if (activeIdRef.current !== questionId) return;
          attemptListen(retriesLeft - 1);
        });
      });
    };

    speak(line, () => attemptListen(MAX_CLARIFY_RETRIES));
  }, [active, now, speak, listen, handleAnswer]);

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

  const dismissKey = `${active.id}:${urgency}`;
  const dismissed = dismissedKey === dismissKey;

  if (dismissed) {
    return activateButton ? (
      <div className="flex justify-center">{activateButton}</div>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setDismissedKey(dismissKey)}
        aria-label="Dismiss"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white/80 hover:bg-white/20"
      >
        ×
      </button>
      {activateButton}
      <DenisVoicePresenceOrb
        size={160}
        moodIntensity={urgencyRatio}
        speaking={speaking}
      />
    </div>
  );
}
