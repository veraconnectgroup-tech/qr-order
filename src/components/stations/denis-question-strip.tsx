"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStationQuestions } from "@/hooks/use-station-questions";
import { useStationRelayMessages } from "@/hooks/use-station-relay-messages";
import { useDenisStationVoice } from "@/hooks/use-denis-station-voice";
import { useDenisVoice } from "@/hooks/use-denis-voice";
import { resolveStationVoiceLine } from "@/components/stations/denis-station-voice-script";
import {
  classifyStationVoiceReply,
  isLikelyDenisEchoTranscript,
  stationVoiceConfirmationLine,
} from "@/lib/denis/stations/classify-station-voice-reply";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";
import {
  buildStationVoiceClarifyLine,
  resolveStationVoiceConversationTurn,
} from "@/lib/denis/stations/station-voice-conversation";
import { parseStationQuestionContext } from "@/lib/denis/stations/station-voice-context";
import {
  isPushToTalkMode,
  resolveStationVoiceAudioEnvironment,
  resolveStationVoiceInputMode,
} from "@/lib/denis/stations/station-voice-context";
import type { StationVoiceTurnResult } from "@/lib/denis/stations/station-voice-context";
import { DenisVoicePresenceOrb } from "@/components/design-system/denis-voice-presence-orb";
import type { DenisVoiceTone } from "@/hooks/use-denis-station-voice";
import { resolveInteractionTone } from "@/lib/denis/cognition/personality/staff-relationship-engine";
import { resolveConversationRespectSignal } from "@/lib/denis/cognition/personality/resolve-conversation-respect-signal";

function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
}

export type QuestionUrgency = "normal" | "urgent" | "critical";

/** Max back-and-forth turns after the opening question (listen → reply → Denis speaks). */
const MAX_CONVERSATION_TURNS = 6;
const LISTEN_AFTER_SPEAK_MS = 700;
const EMPTY_LISTEN_LINE =
  "Nisam dobro čuo — možete ponoviti? Pitam za status porudžbine.";

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
  const {
    incoming: relayIncoming,
    undeliveredReplies: relayUndeliveredReplies,
    answerRelay,
    acknowledgeDelivery: acknowledgeRelayDelivery,
  } = useStationRelayMessages(locationId, station);
  const spokenRelayIdsRef = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const { speak, activate, voicePrimed, speaking } =
    useDenisStationVoice(locationId);
  const voiceInputMode = resolveStationVoiceInputMode(station);
  const stationAudioEnvironment = resolveStationVoiceAudioEnvironment(station);
  const pushToTalkEnabled = isPushToTalkMode(voiceInputMode);
  const stationVoiceCapture = useDenisVoice({
    enabled: voicePrimed,
    language: "sr",
    menuLanguage: "sr",
    autoSpeak: false,
    sessionToken: locationId,
    audioEnvironment: stationAudioEnvironment,
  });
  const staffReplyHandlerRef = useRef<
    ((transcript: string) => void) | null
  >(null);
  const spokenTiersRef = useRef<Set<string>>(new Set());
  const priorTurnsRef = useRef<Array<{ role: "denis" | "staff"; text: string }>>(
    []
  );
  const [turnsHydrated, setTurnsHydrated] = useState(false);

  const persistTurn = useCallback(
    (questionId: string, role: "denis" | "staff", text: string) => {
      void fetch("/api/denis/station-voice/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, role, text }),
      }).catch(() => {
        // Offline — local ref still holds the turn for this session.
      });
    },
    []
  );

  const active = questions[0] ?? null;
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active?.id) {
      priorTurnsRef.current = [];
      setTurnsHydrated(true);
      return;
    }

    setTurnsHydrated(false);
    void fetch(
      `/api/denis/station-voice/turns?questionId=${encodeURIComponent(active.id)}`
    )
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as {
          data?: { turns?: Array<{ role: "denis" | "staff"; text: string }> };
        };
        priorTurnsRef.current = body.data?.turns ?? [];
      })
      .catch(() => {
        priorTurnsRef.current = [];
      })
      .finally(() => setTurnsHydrated(true));
  }, [active?.id]);

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
  //
  // Only announce after the staff taps "Aktiviraj Denisa" (voicePrimed) and
  // while Denis isn't already speaking — otherwise we'd mark the tier as
  // spoken while speak() no-ops, and Denis would stay silent after
  // "Denis je spreman."
  useEffect(() => {
    if (!active || !voicePrimed || speaking || !turnsHydrated) return;
    const tier = resolveUrgency(
      active.asked_at,
      active.expires_at,
      now,
      extractWaitMinutes(active.message)
    );
    const key = `${active.id}:${tier}`;
    if (spokenTiersRef.current.has(key)) return;
    const line = resolveStationVoiceLine(tier, active.message, station);
    if (!line) return;
    const questionId = active.id;
    const questionType = active.question_type;
    const voiceContext = parseStationQuestionContext(
      active.message,
      questionType,
      station
    );

    // Same Denis voice identity always — only how pressured he sounds shifts,
    // from how urgent this question is and how slammed the station really is.
    // venueChaosRatio itself is recomputed server-side from real order
    // backlog (resolve-station-voice-snapshot.ts) — the client can't see
    // that data, so it only sends urgency + which station this is.
    const tone: DenisVoiceTone = {
      urgencyRatio: resolveUrgencyRatio(
        active.asked_at,
        active.expires_at,
        now,
        extractWaitMinutes(active.message)
      ),
      station,
    };

    // Scoped to THIS still-open conversation only — never written anywhere
    // persistent, discarded the moment this effect re-runs for the next
    // question. Denis doesn't need to know WHO is dodging him, just that
    // this exchange has been dodged (see resolve-conversation-respect-signal.ts).
    const respectSignal = {
      dismissiveTranscriptSeen: false,
      turnsConsumed: 0,
      wasAbandoned: false,
    };
    const currentTone = (): DenisVoiceTone => ({
      ...tone,
      respectPressure: resolveConversationRespectSignal(respectSignal),
    });

    const speakTurn = (
      turn: StationVoiceTurnResult,
      onDone?: () => void,
      skipPersist = false
    ) => {
      if (!turn.speak) {
        onDone?.();
        return;
      }
      priorTurnsRef.current.push({ role: "denis", text: turn.speak });
      if (!skipPersist) {
        persistTurn(questionId, "denis", turn.speak);
      }
      speak(turn.speak, onDone, currentTone());
    };

    const offlineTurn = (transcript: string): StationVoiceTurnResult => {
      const conversational = resolveStationVoiceConversationTurn({
        context: voiceContext,
        staffTranscript: transcript,
        priorTurns: priorTurnsRef.current,
      });
      return (
        conversational ?? {
          speak: buildStationVoiceClarifyLine(voiceContext),
          resolved: null,
          continueListening: true,
        }
      );
    };

    const finishResolved = (turn: StationVoiceTurnResult, skipPersist = false) => {
      if (!turn.resolved) return false;
      const submit = () => {
        void handleAnswer(turn.resolved!.answer, turn.resolved!.etaMinutes).then(
          () => {
            spokenTiersRef.current.add(`${questionId}:answered`);
          }
        );
      };
      if (turn.speak) {
        speakTurn(turn, submit, skipPersist);
      } else {
        submit();
      }
      return true;
    };

    const continueConversation = (
      turn: StationVoiceTurnResult,
      turnsLeft: number,
      skipPersist = false
    ) => {
      speakTurn(
        turn,
        () => {
          if (activeIdRef.current !== questionId) return;
          if (turn.continueListening && turnsLeft > 0) {
            listenForReply((next) => processStaffReply(next, turnsLeft - 1));
          }
        },
        skipPersist
      );
    };

    const listenForReply = (onTranscript: (transcript: string) => void) => {
      if (pushToTalkEnabled) {
        staffReplyHandlerRef.current = onTranscript;
        return;
      }
      window.setTimeout(() => {
        stationVoiceCapture.startListening((result) => {
          if (result.ok && result.transcript.trim()) {
            onTranscript(result.transcript);
          }
        });
      }, LISTEN_AFTER_SPEAK_MS);
    };

    const resolveLocally = (trimmed: string): boolean => {
      if (isLikelyDenisEchoTranscript(trimmed)) return false;
      const reply = classifyStationVoiceReply(trimmed, questionType);
      if (!reply) return false;
      const confirm = stationVoiceConfirmationLine(reply);
      priorTurnsRef.current.push({ role: "staff", text: trimmed });
      priorTurnsRef.current.push({ role: "denis", text: confirm });
      persistTurn(questionId, "staff", trimmed);
      persistTurn(questionId, "denis", confirm);
      speak(
        confirm,
        () => {
          void handleAnswer(reply.answer, reply.etaMinutes).then(() => {
            spokenTiersRef.current.add(`${questionId}:answered`);
          });
        },
        currentTone()
      );
      return true;
    };

    const processStaffReply = (transcript: string, turnsLeft: number) => {
      if (activeIdRef.current !== questionId) {
        respectSignal.wasAbandoned = true;
        return;
      }

      const trimmed = transcript.trim();
      respectSignal.turnsConsumed = Math.max(
        respectSignal.turnsConsumed,
        MAX_CONVERSATION_TURNS - turnsLeft
      );
      if (trimmed && resolveInteractionTone(trimmed) === "curt") {
        respectSignal.dismissiveTranscriptSeen = true;
      }

      if (!trimmed || isLikelyDenisEchoTranscript(trimmed)) {
        if (turnsLeft <= 0) return;
        speak(
          EMPTY_LISTEN_LINE,
          () => {
            if (activeIdRef.current !== questionId) return;
            listenForReply((next) => processStaffReply(next, turnsLeft - 1));
          },
          currentTone()
        );
        return;
      }

      if (resolveLocally(trimmed)) return;

      priorTurnsRef.current.push({ role: "staff", text: trimmed });

      void fetch("/api/denis/station-voice/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          transcript: trimmed,
        }),
      })
        .then(async (res) => {
          if (activeIdRef.current !== questionId) return;

          if (!res.ok) {
            if (resolveLocally(trimmed)) return;
            if (turnsLeft <= 0) return;
            continueConversation(offlineTurn(trimmed), turnsLeft);
            return;
          }

          const body = (await res.json()) as {
            ok?: boolean;
            data?: {
              turn?: {
                speak: string;
                resolved: {
                  answer: NonNullable<StationQuestionRow["answer"]>;
                  etaMinutes?: number;
                } | null;
                continueListening: boolean;
              };
            };
          };

          const turn = body.data?.turn;
          if (!turn) {
            if (turnsLeft <= 0) return;
            continueConversation(offlineTurn(trimmed), turnsLeft);
            return;
          }

          if (turn.resolved) {
            if (finishResolved(turn, true)) return;
          }

          if (!turn.speak) return;
          continueConversation(turn, turnsLeft, true);
        })
        .catch(() => {
          if (activeIdRef.current !== questionId) return;
          if (resolveLocally(trimmed)) return;
          if (turnsLeft <= 0) return;
          continueConversation(offlineTurn(trimmed), turnsLeft);
        });
    };

    if (priorTurnsRef.current.length > 0) {
      spokenTiersRef.current.add(key);
      listenForReply((transcript) =>
        processStaffReply(transcript, MAX_CONVERSATION_TURNS)
      );
      return;
    }

    const started = speak(
      line,
      () =>
        listenForReply((transcript) =>
          processStaffReply(transcript, MAX_CONVERSATION_TURNS)
        ),
      currentTone()
    );
    if (!started) return;

    spokenTiersRef.current.add(key);
    priorTurnsRef.current = [{ role: "denis", text: line }];
    persistTurn(questionId, "denis", line);
  }, [
    active,
    now,
    speak,
    handleAnswer,
    station,
    voicePrimed,
    speaking,
    turnsHydrated,
    persistTurn,
    pushToTalkEnabled,
  ]);

  // Relay messages (from "Pozovi Denisa" at the other station, or Denis's
  // own initiative) — much simpler than the question flow above: speak,
  // capture one free-text reply (no keyword classification, no resolved
  // enum), done. Delivering an answered reply back to whichever station
  // originally asked takes priority over speaking a fresh incoming one.
  useEffect(() => {
    if (!voicePrimed || speaking) return;

    const replyToDeliver = relayUndeliveredReplies.find(
      (row) => !spokenRelayIdsRef.current.has(`reply:${row.id}`)
    );
    if (replyToDeliver) {
      spokenRelayIdsRef.current.add(`reply:${replyToDeliver.id}`);
      const askerLabel = replyToDeliver.from_station === "kitchen" ? "Kuhinja" : "Bar";
      speak(`${askerLabel} pita — odgovor stigao: ${replyToDeliver.reply}`, () => {
        void acknowledgeRelayDelivery(replyToDeliver.id);
      });
      return;
    }

    const incomingToSpeak = relayIncoming.find(
      (row) => !spokenRelayIdsRef.current.has(`ask:${row.id}`)
    );
    if (!incomingToSpeak) return;
    spokenRelayIdsRef.current.add(`ask:${incomingToSpeak.id}`);

    speak(incomingToSpeak.message, () => {
      window.setTimeout(() => {
        stationVoiceCapture.startListening((result) => {
          if (result.ok && result.transcript.trim()) {
            void answerRelay(incomingToSpeak.id, result.transcript.trim());
          }
        });
      }, LISTEN_AFTER_SPEAK_MS);
    });
  }, [
    voicePrimed,
    speaking,
    relayIncoming,
    relayUndeliveredReplies,
    speak,
    answerRelay,
    acknowledgeRelayDelivery,
    stationVoiceCapture,
  ]);

  const pushToTalkButton =
    pushToTalkEnabled && voicePrimed ? (
      <button
        type="button"
        disabled={speaking || busy}
        aria-label="Drži za govor"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          stationVoiceCapture.startListening((result) => {
            if (!result.ok || !result.transcript.trim()) return;
            staffReplyHandlerRef.current?.(result.transcript);
          });
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          stationVoiceCapture.stopListening();
        }}
        onPointerCancel={() => {
          stationVoiceCapture.stopListening();
        }}
        className={`min-h-12 min-w-48 touch-target rounded-full border px-6 text-sm font-semibold transition ${
          stationVoiceCapture.listening
            ? "border-orange-400 bg-orange-500/30 text-orange-100"
            : "border-orange-500/50 bg-orange-500/15 text-orange-200 hover:bg-orange-500/25"
        }`}
      >
        {stationVoiceCapture.listening ? "Slušam…" : "Drži za odgovor"}
      </button>
    ) : null;

  const activateButton = voicePrimed ? null : (
    <button
      type="button"
      onClick={activate}
      className="min-h-11 rounded-full border border-orange-500/50 bg-orange-500/15 px-4 text-sm font-semibold text-orange-200 hover:bg-orange-500/25"
    >
      Aktiviraj Denisa 🔊
    </button>
  );

  // Relay activity (incoming message to speak/answer, or a reply to
  // deliver back) keeps the orb overlay up even with no active order
  // question — it's a separate reason for Denis to have the floor.
  const hasRelayActivity =
    relayIncoming.length > 0 || relayUndeliveredReplies.length > 0;

  const remaining = active ? secondsLeft(active.expires_at, now) : 0;
  const activeWaitMinutes = active ? extractWaitMinutes(active.message) : null;
  const urgencyRatio = active
    ? resolveUrgencyRatio(active.asked_at, active.expires_at, now, activeWaitMinutes)
    : 0;
  const urgency = active
    ? resolveUrgency(active.asked_at, active.expires_at, now, activeWaitMinutes)
    : "normal";
  const dismissKey = active ? `${active.id}:${urgency}` : null;
  const dismissed = dismissKey != null && dismissedKey === dismissKey;

  const showActiveQuestion = Boolean(active) && remaining > 0 && !dismissed;

  if (!showActiveQuestion && !hasRelayActivity) {
    return activateButton ? (
      <div className="flex justify-center">{activateButton}</div>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop on its own layer — backdrop-filter on the same subtree as
          the orb's filter/transform animations makes the orb paint invisible
          in Safari/Chrome (compositing bug). Content sits in a sibling layer. */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-hidden
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-8 p-4">
        {showActiveQuestion && dismissKey && (
          <button
            type="button"
            onClick={() => setDismissedKey(dismissKey)}
            aria-label="Dismiss"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white/80 hover:bg-white/20"
          >
            ×
          </button>
        )}

        {activateButton}
        {pushToTalkButton}
        <DenisVoicePresenceOrb
          size={220}
          moodIntensity={urgencyRatio}
          speaking={speaking}
        />
      </div>
    </div>
  );
}
