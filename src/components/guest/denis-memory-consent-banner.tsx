"use client";

import { Button } from "@/components/ui/button";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";

type DenisMemoryConsentBannerProps = {
  onAccept: () => void;
  onDecline: () => void;
  promptTemplate?: string | null;
};

export function DenisMemoryConsentBanner({
  onAccept,
  onDecline,
  promptTemplate,
}: DenisMemoryConsentBannerProps) {
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-12 bg-[var(--qr-ember)] text-white hover:bg-[var(--qr-ember-hover)]"
              onClick={onAccept}
            >
              {tUI("ai.memory.consentAccept")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-12 text-[var(--qr-muted)] hover:bg-[var(--qr-elevated)] hover:text-[var(--qr-ivory)]"
              onClick={onDecline}
            >
              {tUI("ai.memory.consentDecline")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
