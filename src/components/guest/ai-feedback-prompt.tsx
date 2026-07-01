"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { GoogleReviewSheet } from "@/components/guest/google-review-sheet";
import { ReferralPromptSheet } from "@/components/guest/referral-prompt-sheet";
import { Button } from "@/components/ui/button";
import { buildFeedbackReviewOffer } from "@/lib/denis/commerce/build-feedback-review-offer";
import {
  analyzeFeedbackComment,
  FEEDBACK_DELAY_MS,
  resolveFeedbackPostSubmit,
  type FeedbackPostSubmitFlow,
} from "@/lib/denis/platform/feedback-intelligence";
import { ratingToSentiment } from "@/lib/commerce/experience/resolve-experience-moment";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;

export function AiFeedbackPrompt({
  orderId,
  sessionToken,
  deliveredAt,
  googleReviewUrl,
  locationId,
  deviceFingerprint,
  slug,
  tableToken,
  venueName,
}: {
  orderId: string;
  sessionToken: string;
  deliveredAt: string | null;
  googleReviewUrl: string | null;
  locationId?: string;
  tableId?: string;
  deviceFingerprint?: string;
  slug?: string;
  tableToken?: string;
  venueName?: string;
}) {
  const { tUI, menuLocale: language } = useAppLocale();
  const [delayReady, setDelayReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [followupComment, setFollowupComment] = useState("");
  const [followupSent, setFollowupSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postFlow, setPostFlow] = useState<FeedbackPostSubmitFlow | null>(null);

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
          const existingSentiment = json.data?.feedback?.sentiment;
          if (typeof existingRating === "number") {
            setRating(existingRating);
            const sentiment =
              existingSentiment === "positive" ||
              existingSentiment === "neutral" ||
              existingSentiment === "negative"
                ? existingSentiment
                : ratingToSentiment(existingRating);
            setPostFlow(
              resolveFeedbackPostSubmit({
                rating: existingRating,
                sentiment,
                language,
              })
            );
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
  }, [delayReady, language, orderId, sessionToken]);

  const reviewOffer = useMemo(() => {
    if (
      !submitted ||
      postFlow?.kind !== "google_review" ||
      !googleReviewUrl?.trim() ||
      !deliveredAt
    ) {
      return null;
    }

    return buildFeedbackReviewOffer({
      orderId,
      googleReviewUrl,
      paidAnchorAt: deliveredAt,
      language,
      sessionToken,
    });
  }, [
    deliveredAt,
    googleReviewUrl,
    language,
    orderId,
    postFlow?.kind,
    sessionToken,
    submitted,
  ]);

  async function handleSubmit() {
    if (rating < 1 || saving) return;
    setSaving(true);
    setError(null);

    const analysis = analyzeFeedbackComment({ rating, comment });

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          sessionToken,
          rating,
          comment: comment.trim() || undefined,
          sentiment: analysis.sentiment,
          category: analysis.category,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? tUI("feedback.error"));
        return;
      }

      setSubmitted(true);
      setPostFlow(
        resolveFeedbackPostSubmit({
          rating,
          sentiment: analysis.sentiment,
          language,
        })
      );
    } catch {
      setError(tUI("feedback.error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleFollowupSubmit() {
    if (!followupComment.trim() || saving) return;
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
          comment: followupComment.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok && res.status !== 409) {
        setError(json.error ?? tUI("feedback.error"));
        return;
      }

      setFollowupSent(true);
    } catch {
      setError(tUI("feedback.error"));
    } finally {
      setSaving(false);
    }
  }

  if (!deliveredAt || !delayReady || loading) return null;

  const displayRating = hoverRating || rating;
  const showReferral =
    rating >= 4 &&
    !!locationId &&
    !!deviceFingerprint &&
    !!slug &&
    !!tableToken &&
    !!venueName;

  const referralBlock =
    showReferral && submitted ? (
      <ReferralPromptSheet
        locationId={locationId!}
        guestToken={deviceFingerprint!}
        slug={slug!}
        tableToken={tableToken!}
        venueName={venueName!}
        trigger
      />
    ) : null;

  if (submitted && reviewOffer) {
    return (
      <section className="mb-5 space-y-3">
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80">
          <div className="p-5 text-center">
            <p className="text-base font-medium text-zinc-100">
              {tUI("feedback.thanks")}
            </p>
          </div>
          <GoogleReviewSheet offer={reviewOffer} sessionToken={sessionToken} />
        </div>
        {referralBlock}
      </section>
    );
  }

  if (submitted && postFlow?.kind === "denis_followup" && !followupSent && !comment.trim()) {
    return (
      <section className="mb-5 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-zinc-900 to-zinc-900 p-5">
        <div className="flex items-start gap-3">
          <DenisMarkBadge size="sm" className="mt-0.5 shrink-0 ring-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">{postFlow.message}</p>
            <label className="mt-3 block">
              <textarea
                value={followupComment}
                onChange={(e) => setFollowupComment(e.target.value)}
                placeholder={tUI("feedback.commentPlaceholder")}
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-orange-500"
              />
            </label>
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
            <Button
              type="button"
              disabled={!followupComment.trim() || saving}
              onClick={() => void handleFollowupSubmit()}
              className="mt-3 h-11 w-full rounded-xl bg-orange-500 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? tUI("feedback.sending") : tUI("feedback.submit")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="mb-5 space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 text-center">
          <p className="text-base font-medium text-zinc-100">
            {postFlow?.message ?? tUI("feedback.thanks")}
          </p>
        </div>
        {referralBlock}
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-zinc-900 to-zinc-900 p-5">
      <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-zinc-100">
        <DenisMarkBadge size="sm" className="ring-0" />
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
        onClick={() => void handleSubmit()}
        className="mt-4 h-12 w-full rounded-xl bg-orange-500 text-base font-semibold hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? tUI("feedback.sending") : tUI("feedback.submit")}
      </Button>
    </section>
  );
}
