"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { createClient } from "@/lib/supabase/client";
import type { StationQuestionRow } from "@/lib/denis/stations/station-questions";

const POLL_MS = 5_000;
const POLL_MAX_MS = 3 * 60_000;

function answerLabel(question: StationQuestionRow): string {
  const station = question.station === "kitchen" ? "Kuhinja" : "Bar";
  switch (question.answer) {
    case "eta":
      return `${station}: još ~${question.answer_eta_minutes} min`;
    case "ready":
      return `${station}: spremno`;
    case "problem":
      return `${station}: problem ⚠`;
    case "accepted":
      return `${station}: kreće odmah`;
    case "picked_up":
      return `${station}: preuzeto`;
    case "still_waiting":
      return `${station}: čeka na prozoru`;
    default:
      return `${station}: odgovoreno`;
  }
}

/** Manager one-tap "ask the station" for an in-flight order (Denis question card). */
export function AskStationButton({
  orderId,
  station,
  disabled,
}: {
  orderId: string;
  station: "kitchen" | "bar";
  disabled?: boolean;
}) {
  const { aiConciergeEnabled } = useDashboard();
  const [phase, setPhase] = useState<
    "idle" | "sending" | "waiting" | "answered" | "expired"
  >("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const questionIdRef = useRef<string | null>(null);
  const pollStartedAtRef = useRef(0);

  useEffect(() => {
    if (phase !== "waiting") return;

    const id = setInterval(async () => {
      const questionId = questionIdRef.current;
      if (!questionId) return;

      if (Date.now() - pollStartedAtRef.current > POLL_MAX_MS) {
        setPhase("idle");
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("station_questions")
        .select("*")
        .eq("id", questionId)
        .maybeSingle();

      const question = data as StationQuestionRow | null;
      if (!question || question.status === "open") return;

      if (question.status === "answered") {
        setAnswer(answerLabel(question));
        setPhase("answered");
      } else {
        setPhase("expired");
      }
    }, POLL_MS);

    return () => clearInterval(id);
  }, [phase]);

  if (!aiConciergeEnabled) return null;

  const ask = async () => {
    setPhase("sending");
    try {
      const response = await fetch("/api/station-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, station }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { question?: StationQuestionRow };
        error?: string;
      } | null;

      if (!response.ok || !payload?.data?.question) {
        toast.error(payload?.error ?? "Pitanje nije moglo da se pošalje.");
        setPhase("idle");
        return;
      }

      questionIdRef.current = payload.data.question.id;
      pollStartedAtRef.current = Date.now();
      setPhase("waiting");
    } catch {
      toast.error("Pitanje nije moglo da se pošalje.");
      setPhase("idle");
    }
  };

  if (phase === "answered" && answer) {
    return (
      <p className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-center text-xs font-semibold text-orange-300">
        {answer}
      </p>
    );
  }

  if (phase === "expired") {
    return (
      <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs font-semibold text-red-300">
        {station === "kitchen" ? "Kuhinja" : "Bar"} nije odgovorio — menadžer
        obavešten
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || phase === "sending" || phase === "waiting"}
      onClick={() => void ask()}
      className="mt-2 w-full rounded-lg border border-orange-500/40 bg-orange-500/10 py-2.5 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 active:scale-[0.98] disabled:opacity-60 touch-manipulation"
    >
      {phase === "sending"
        ? "Šaljem…"
        : phase === "waiting"
          ? "Čekam odgovor…"
          : station === "kitchen"
            ? "Pitaj kuhinju"
            : "Pitaj bar"}
    </button>
  );
}
