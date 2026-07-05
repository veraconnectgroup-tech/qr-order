"use client";

import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type DenisVoiceMicButtonProps = {
  listening: boolean;
  disabled?: boolean;
  supported: boolean;
  listenLabel: string;
  listeningLabel: string;
  unsupportedLabel: string;
  onStart: () => void;
  onStop: () => void;
};

export function DenisVoiceMicButton({
  listening,
  disabled = false,
  supported,
  listenLabel,
  listeningLabel,
  unsupportedLabel,
  onStart,
  onStop,
}: DenisVoiceMicButtonProps) {
  const inactive = disabled || !supported;

  return (
    <button
      type="button"
      disabled={inactive}
      aria-label={listening ? listeningLabel : listenLabel}
      title={!supported ? unsupportedLabel : undefined}
      onClick={() => {
        if (inactive) return;
        if (listening) {
          onStop();
        } else {
          onStart();
        }
      }}
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full border transition touch-target",
        listening
          ? "border-orange-400 bg-orange-500/25 text-orange-200"
          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600",
        inactive && "cursor-not-allowed opacity-40"
      )}
    >
      {listening ? (
        <Square className="size-5 fill-current" aria-hidden />
      ) : (
        <Mic className="size-5" aria-hidden />
      )}
    </button>
  );
}
