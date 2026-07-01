"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { getOrCreateDeviceFingerprint } from "@/lib/guest/device-storage";
import {
  REVIEW_DISMISS_COOLDOWN_DAYS,
  REVIEW_PROMPT_COOLDOWN_DAYS,
} from "@/lib/denis/commerce/review-funnel";
import type { GoogleReviewOffer } from "@/lib/denis/loop/view-types";

const PROMPT_AT_KEY = "denis_review_prompt_at";
const DISMISS_AT_KEY = "denis_review_dismiss_at";

function readStoredIso(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStoredIso(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return (Date.now() - parsed) / 86_400_000;
}

function localSpamBlocksOffer(): boolean {
  const sincePrompt = daysSince(readStoredIso(PROMPT_AT_KEY));
  if (sincePrompt != null && sincePrompt < REVIEW_PROMPT_COOLDOWN_DAYS) {
    return true;
  }
  const sinceDismiss = daysSince(readStoredIso(DISMISS_AT_KEY));
  if (sinceDismiss != null && sinceDismiss < REVIEW_DISMISS_COOLDOWN_DAYS) {
    return true;
  }
  return false;
}

function InternalFeedbackForm({
  orderId,
  sessionToken,
  confirmLabel,
  dismissLabel,
  onDismiss,
  onSubmitted,
}: {
  orderId: string;
  sessionToken: string;
  confirmLabel: string;
  dismissLabel: string;
  onDismiss?: () => void;
  onSubmitted?: () => void;
}) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!comment.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          sessionToken,
          rating: 2,
          comment: comment.trim(),
          sentiment: "negative",
          category: "other",
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Greška pri slanju.");
        return;
      }
      onSubmitted?.();
    } catch {
      setError("Greška pri slanju.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Recite nam šta nije bilo u redu…"
        rows={3}
        maxLength={500}
        className="w-full resize-none rounded-lg border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-3 py-2 text-xs text-[var(--qr-ivory)] outline-none placeholder:text-[var(--qr-muted)] focus:border-[var(--qr-ember)]"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!comment.trim() || saving}
          onClick={() => void handleSubmit()}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--qr-ember)]/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qr-ember)] disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.()}
          className="rounded-full border border-[var(--qr-elevated)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qr-muted)]"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}

/** Smart review funnel UI — Google link or internal feedback by sentiment (L2). */
export function ReviewFunnelSheet({
  offer,
  sessionToken,
  onDismiss,
  onClicked,
  onInternalSubmitted,
}: {
  offer: GoogleReviewOffer;
  sessionToken: string;
  onDismiss?: () => void;
  onClicked?: () => void;
  onInternalSubmitted?: () => void;
}) {
  const [delayReady, setDelayReady] = useState(false);
  const [promptRecorded, setPromptRecorded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const blockedLocally = useMemo(() => localSpamBlocksOffer(), []);
  const isInternal =
    offer.route === "internal" || offer.showInternalForm === true;

  useEffect(() => {
    if (blockedLocally) return;

    const anchorMs = offer.paidAnchorAt
      ? Date.parse(offer.paidAnchorAt)
      : offer.feedbackSubmittedAt
        ? Date.parse(offer.feedbackSubmittedAt)
        : Date.now();
    const delayMs = Math.max(0, offer.delaySeconds * 1000);
    const targetMs = anchorMs + delayMs;
    const remaining = targetMs - Date.now();

    if (remaining <= 0) {
      setDelayReady(true);
      return;
    }

    const timer = window.setTimeout(() => setDelayReady(true), remaining);
    return () => window.clearTimeout(timer);
  }, [blockedLocally, offer.delaySeconds, offer.feedbackSubmittedAt, offer.paidAnchorAt]);

  useEffect(() => {
    if (!delayReady || promptRecorded || blockedLocally) return;

    const now = new Date().toISOString();
    writeStoredIso(PROMPT_AT_KEY, now);
    setPromptRecorded(true);

    void fetch("/api/commerce/review-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: offer.orderId,
        sessionToken,
        action: "prompt_shown",
        deviceFingerprint: getOrCreateDeviceFingerprint(),
        triggerMoment: offer.triggerMoment ?? null,
        experienceScore: offer.experienceScore ?? null,
      }),
    });
  }, [
    blockedLocally,
    delayReady,
    offer.experienceScore,
    offer.orderId,
    offer.triggerMoment,
    promptRecorded,
    sessionToken,
  ]);

  if (blockedLocally || !delayReady || dismissed) return null;

  async function recordDismiss() {
    const now = new Date().toISOString();
    writeStoredIso(DISMISS_AT_KEY, now);
    writeStoredIso(PROMPT_AT_KEY, now);
    void fetch("/api/commerce/review-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: offer.orderId,
        sessionToken,
        action: "dismissed",
        deviceFingerprint: getOrCreateDeviceFingerprint(),
        triggerMoment: offer.triggerMoment ?? null,
        experienceScore: offer.experienceScore ?? null,
      }),
    });
    setDismissed(true);
    onDismiss?.();
  }

  async function handleGoogleClick() {
    if (!offer.googleReviewUrl) return;
    void fetch("/api/commerce/review-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: offer.orderId,
        sessionToken,
        googleReviewUrl: offer.googleReviewUrl,
        deviceFingerprint: getOrCreateDeviceFingerprint(),
        triggerMoment: offer.triggerMoment ?? null,
      }),
    });
    window.open(offer.googleReviewUrl, "_blank", "noopener,noreferrer");
    onClicked?.();
  }

  return (
    <div className="border-t border-[var(--qr-elevated)]/80 px-3 py-3">
      {offer.recoveryFollowUpMessage && (
        <p className="mb-2 text-[10px] text-[var(--qr-muted)]">
          {offer.recoveryFollowUpMessage}
        </p>
      )}
      <p className="text-xs leading-snug text-[var(--qr-ivory)]">{offer.message}</p>
      {offer.contentSuggestion && (
        <p className="mt-1 text-[10px] text-[var(--qr-muted)]">
          {offer.contentSuggestion}
        </p>
      )}

      {isInternal ? (
        <InternalFeedbackForm
          orderId={offer.orderId}
          sessionToken={sessionToken}
          confirmLabel={offer.confirmLabel}
          dismissLabel={offer.dismissLabel}
          onDismiss={() => void recordDismiss()}
          onSubmitted={() => {
            setDismissed(true);
            onInternalSubmitted?.();
          }}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void handleGoogleClick()}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--qr-ember)]/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qr-ember)]"
          >
            <Star className="size-3 fill-current" />
            {offer.confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => void recordDismiss()}
            className="rounded-full border border-[var(--qr-elevated)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qr-muted)]"
          >
            {offer.dismissLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** @deprecated use ReviewFunnelSheet */
export function GoogleReviewSheet(props: {
  offer: GoogleReviewOffer;
  sessionToken: string;
  onDismiss?: () => void;
  onClicked?: () => void;
}) {
  return <ReviewFunnelSheet {...props} />;
}
