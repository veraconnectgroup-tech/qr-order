"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEEDBACK_DELAY_MS = 10 * 60_000;
const POLL_MS = 15_000;

export function AiFeedbackPrompt({
  orderId,
  sessionToken,
  deliveredAt,
  googleReviewUrl,
}: {
  orderId: string;
  sessionToken: string;
  deliveredAt: string | null;
  googleReviewUrl: string | null;
}) {
  const { tUI } = useAppLocale();
  const [delayReady, setDelayReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deliveredAt) return;

    const check = () => {
      const elapsed = Date.now() - new Date(deliveredAt).getTime();
      if (elapsed >= FEEDBACK_DELAY_MS) setDelayReady(true);
    };

    check();
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [deliveredAt]);

  useEffect(() => {
    if (!delayReady) return;

    let cancelled = false;

    async function checkExisting() {
      try {
        const res = await fetch(
          `/api/feedback?orderId=${encodeURIComponent(orderId)}&sessionToken=${encodeURIComponent(sessionToken)}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.data?.submitted) {
          setSubmitted(true);
          const existingRating = json.data?.feedback?.rating;
          if (typeof existingRating === "number") {
            setRating(existingRating);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkExisting();
    return () => {
      cancelled = true;
    };
  }, [delayReady, orderId, sessionToken]);

  async function handleSubmit() {
    if (rating < 1 || saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          sessionToken,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? tUI("feedback.error"));
        return;
      }

      setSubmitted(true);
    } catch {
      setError(tUI("feedback.error"));
    } finally {
      setSaving(false);
    }
  }

  if (!deliveredAt || !delayReady || loading) return null;

  const displayRating = hoverRating || rating;
  const showGoogleReview =
    submitted && rating >= 4 && !!googleReviewUrl;

  if (submitted && !showGoogleReview) {
    return (
      <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 text-center">
        <p className="text-base font-medium text-zinc-100">
          {tUI("feedback.thanks")}
        </p>
      </section>
    );
  }

  if (submitted && showGoogleReview) {
    return (
      <section className="mb-5 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
        <p className="text-center text-base font-medium text-zinc-100">
          {tUI("feedback.thanks")}
        </p>
        <p className="text-center text-sm text-zinc-300">
          {tUI("feedback.googleReview")}
        </p>
        <Button
          type="button"
          onClick={() =>
            window.open(googleReviewUrl!, "_blank", "noopener,noreferrer")
          }
          className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold hover:bg-orange-600"
        >
          <Star className="me-2 size-4 fill-white" />
          {tUI("feedback.googleReviewButton")}
        </Button>
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-zinc-900 to-zinc-900 p-5">
      <h2 className="text-center text-base font-semibold text-zinc-100">
        {tUI("feedback.title")}
      </h2>

      <div
        className="mt-4 flex justify-center gap-1.5"
        role="radiogroup"
        aria-label={tUI("feedback.title")}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHoverRating(value)}
            onMouseLeave={() => setHoverRating(0)}
            className="rounded-lg p-2 transition hover:bg-zinc-800/80"
          >
            <Star
              className={cn(
                "size-9 transition-colors",
                value <= displayRating
                  ? "fill-orange-400 text-orange-400"
                  : "text-zinc-600"
              )}
            />
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs text-zinc-500">
          {tUI("feedback.commentLabel")}
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={tUI("feedback.commentPlaceholder")}
          rows={2}
          maxLength={500}
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-orange-500"
        />
      </label>

      {error && (
        <p className="mt-2 text-center text-sm text-red-400">{error}</p>
      )}

      <Button
        type="button"
        disabled={rating < 1 || saving}
        onClick={handleSubmit}
        className="mt-4 h-12 w-full rounded-xl bg-orange-500 text-base font-semibold hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? tUI("feedback.sending") : tUI("feedback.submit")}
      </Button>
    </section>
  );
}
