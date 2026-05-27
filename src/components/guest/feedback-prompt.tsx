"use client";

import { useEffect, useState } from "react";
import { Star, Sparkles } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FeedbackPrompt({
  orderId,
  sessionToken,
}: {
  orderId: string;
  sessionToken: string;
}) {
  const { tUI } = useAppLocale();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkExisting();
    return () => {
      cancelled = true;
    };
  }, [orderId, sessionToken]);

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

  if (loading) return null;
  if (submitted) {
    return (
      <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 text-center">
        <p className="text-base font-medium text-zinc-100">
          {tUI("feedback.thanks")}
        </p>
      </section>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
      <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-zinc-100">
        <Sparkles className="size-4 text-orange-400" aria-hidden />
        {tUI("feedback.title")}
      </h2>
      <p className="mt-1 text-center text-sm text-zinc-500">
        {tUI("feedback.subtitle")}
      </p>

      <div
        className="mt-4 flex justify-center gap-2"
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
          rows={3}
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
