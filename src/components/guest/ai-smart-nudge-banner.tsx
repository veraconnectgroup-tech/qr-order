"use client";

import {
  CakeSlice,
  Clock,
  MessageCircle,
  Plus,
  Wine,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { SmartNudge, SmartNudgeKind } from "@/hooks/use-smart-nudges";
import { hapticClick } from "@/lib/haptics";
import { cn } from "@/lib/utils";

function NudgeIcon({ kind }: { kind: SmartNudgeKind }) {
  const className = "size-4";
  switch (kind) {
    case "dessert_nudge":
      return <CakeSlice className={className} aria-hidden />;
    case "slow_kitchen":
      return <Clock className={className} aria-hidden />;
    case "drink_pairing":
      return <Wine className={className} aria-hidden />;
    case "browse_nudge":
    default:
      return <MessageCircle className={className} aria-hidden />;
  }
}

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
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {nudge && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="mx-4 mb-3"
        >
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
              "flex items-center gap-3 rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-500/15 via-zinc-900 to-zinc-900 px-4 py-3 shadow-lg shadow-black/20",
              nudge.kind !== "drink_pairing" && "cursor-pointer active:scale-[0.99]"
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
              <NudgeIcon kind={nudge.kind} />
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug text-zinc-100">
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
                    className="flex size-9 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 active:scale-95"
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
                className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-300"
                aria-label={tUI("ai.proactive.dismiss")}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
