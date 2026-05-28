"use client";

import { Plus, X } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { SmartNudge } from "@/hooks/use-smart-nudges";
import { hapticClick } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export function AiSmartNudgeBanner({
  nudge,
  orderingDisabled,
  onAction,
  onAdd,
  onDismiss,
}: {
  nudge: SmartNudge | null;
  orderingDisabled?: boolean;
  onAction: () => void;
  onAdd?: () => void;
  onDismiss: () => void;
}) {
  const { tUI } = useAppLocale();

  if (!nudge) return null;

  return (
    <div className="mx-4 mb-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (nudge.kind === "drink_pairing" && nudge.recommendation) return;
          hapticClick();
          onAction();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (nudge.kind === "drink_pairing" && nudge.recommendation) return;
            onAction();
          }
        }}
        className={cn(
          "flex items-center gap-3 rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)] px-3 py-2.5 before:pointer-events-none before:absolute relative overflow-hidden before:inset-x-0 before:top-0 before:h-0.5 before:bg-[var(--qr-ember)] before:content-['']",
          nudge.kind !== "drink_pairing" && "cursor-pointer active:scale-[0.99]"
        )}
      >
        <DenisMarkBadge size="md" />
        <p className="min-w-0 flex-1 text-sm leading-snug text-[var(--qr-ivory)]">
          {nudge.message}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {nudge.kind === "drink_pairing" &&
            nudge.recommendation &&
            !orderingDisabled &&
            onAdd && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticClick();
                  onAdd();
                }}
                className="flex size-9 items-center justify-center rounded-full bg-[var(--qr-ember)] text-white transition active:scale-95"
                aria-label={tUI("ai.proactive.add", {
                  name: nudge.recommendation.name,
                })}
              >
                <Plus className="size-4" />
              </button>
            )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="flex size-8 items-center justify-center rounded-full text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)]"
            aria-label={tUI("ai.proactive.dismiss")}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
