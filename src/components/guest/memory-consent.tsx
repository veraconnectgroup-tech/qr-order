"use client";

import { Button } from "@/components/ui/button";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { GuestMemoryScope } from "@/lib/denis/platform/guest-memory-types";

export type GuestMemoryConsentProps = {
  onAccept: (scopes: GuestMemoryScope[]) => void;
  onDecline: () => void;
  onForget?: () => void;
  promptTemplate?: string | null;
  showForget?: boolean;
  loading?: boolean;
};

const DEFAULT_SCOPES: GuestMemoryScope[] = [
  "allergies",
  "favorites",
  "language",
  "relationship",
];

export function GuestMemoryConsent({
  onAccept,
  onDecline,
  onForget,
  promptTemplate,
  showForget = false,
  loading = false,
}: GuestMemoryConsentProps) {
  const { tUI } = useAppLocale();

  const body =
    promptTemplate?.trim() ||
    tUI("ai.memory.consentBody");

  return (
    <div
      className="mx-4 mb-3 rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-4 py-3"
      role="region"
      aria-label={tUI("ai.memory.consentTitle")}
    >
      <div className="flex items-start gap-3">
        <DenisMarkBadge size="md" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--qr-ivory)]">
            {tUI("ai.memory.consentTitle")}
          </p>
          <p className="mt-1 text-sm text-[var(--qr-muted)]">{body}</p>
          <p className="mt-2 text-xs text-[var(--qr-muted)]">
            {tUI("ai.memory.consentPrivacyNote") ??
              "Denis pamti samo ono što odobrite. Možete obrisati memoriju u bilo kom trenutku."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loading}
              className="min-h-12 bg-[var(--qr-ember)] text-white hover:bg-[var(--qr-ember-hover)]"
              onClick={() => onAccept(DEFAULT_SCOPES)}
            >
              {tUI("ai.memory.consentAccept")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading}
              className="min-h-12 text-[var(--qr-muted)] hover:bg-[var(--qr-elevated)] hover:text-[var(--qr-ivory)]"
              onClick={onDecline}
            >
              {tUI("ai.memory.consentDecline")}
            </Button>
            {showForget && onForget ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={loading}
                className="min-h-12 text-red-400/90 hover:bg-red-500/10 hover:text-red-300"
                onClick={onForget}
              >
                {tUI("ai.memory.forgetMe") ?? "Forget me"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
