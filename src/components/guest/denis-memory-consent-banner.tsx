"use client";

import { Button } from "@/components/ui/button";
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
      className="mx-4 mb-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3"
      role="region"
      aria-label={tUI("ai.memory.consentTitle")}
    >
      <p className="text-sm font-medium text-orange-50">
        {tUI("ai.memory.consentTitle")}
      </p>
      <p className="mt-1 text-sm text-orange-100/90">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-12 bg-orange-500 text-white hover:bg-orange-600"
          onClick={onAccept}
        >
          {tUI("ai.memory.consentAccept")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-12 text-orange-100 hover:bg-orange-500/20 hover:text-orange-50"
          onClick={onDecline}
        >
          {tUI("ai.memory.consentDecline")}
        </Button>
      </div>
    </div>
  );
}
