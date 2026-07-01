"use client";

import { Button } from "@/components/ui/button";
import {
  fallbackMessageForLevel,
  FALLBACK_MESSAGES,
  resolveFallbackLocale,
  type DenisFallbackLevel,
} from "@/components/guest/denis-fallback-messages";
import { cn } from "@/lib/utils";

export function DenisFallbackPanel({
  level,
  locale,
  tableLabel,
  onBrowseMenu,
  onCallWaiter,
  onOrderStandard,
  className,
}: {
  level: DenisFallbackLevel;
  locale: string;
  tableLabel?: string;
  onBrowseMenu: () => void;
  onCallWaiter: () => void;
  onOrderStandard?: () => void;
  className?: string;
}) {
  const messages = FALLBACK_MESSAGES[resolveFallbackLocale(locale)];
  const headline = fallbackMessageForLevel(level, locale);

  return (
    <div
      className={cn(
        "rounded-2xl border border-guest-border bg-guest-surface p-4",
        className
      )}
    >
      <p className="text-base font-medium text-guest-text">{headline}</p>
      {tableLabel && level >= 2 && (
        <p className="mt-1 text-xs text-guest-text-muted">{tableLabel}</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {(level === 2 || level === 3) && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-12 w-full justify-start"
            onClick={onBrowseMenu}
          >
            {messages.browseMenu}
          </Button>
        )}
        {level >= 3 && onOrderStandard && (
          <Button
            type="button"
            className="min-h-12 w-full"
            onClick={onOrderStandard}
          >
            {messages.orderStandard}
          </Button>
        )}
        <Button
          type="button"
          variant={level >= 3 ? "outline" : "secondary"}
          className="min-h-12 w-full"
          onClick={onCallWaiter}
        >
          {messages.callWaiter}
        </Button>
      </div>
    </div>
  );
}
