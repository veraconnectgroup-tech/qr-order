"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { Button } from "@/components/ui/button";
import {
  dismissGuestPrompt,
  isGuestPromptDismissed,
} from "@/lib/pwa/dismiss";
import {
  GUEST_INSTALL_PROMPT_MESSAGE,
  shouldShowGuestInstallPrompt,
} from "@/lib/pwa/install-timing";
import { isStandaloneMode } from "@/lib/pwa/device";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";

/** Custom Denis install banner — never the browser default prompt UI (M17). */
export function GuestPwaInstallBanner() {
  const { canInstall, promptInstall, isInstalled, isIos } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isInstalled || isGuestPromptDismissed() || isStandaloneMode()) {
      setVisible(false);
      return;
    }
    if (!shouldShowGuestInstallPrompt()) return;
    if (!canInstall && !isIos) return;
    setVisible(true);
  }, [canInstall, isInstalled, isIos]);

  if (!visible) return null;

  async function handleInstall() {
    if (isIos) {
      setShowIosHint((current) => !current);
      return;
    }
    if (!canInstall) return;
    setInstalling(true);
    try {
      await promptInstall();
      dismissGuestPrompt();
      setVisible(false);
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    dismissGuestPrompt();
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Dodaj na početni ekran"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-orange-500/30 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_32px_rgba(0,0,0,0.45)]"
      )}
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 px-4 py-3">
        <DenisMarkBadge size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-50">Denis</p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-300">
            {GUEST_INSTALL_PROMPT_MESSAGE}
          </p>
          {showIosHint && isIos ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-400">
              <Share className="size-3.5 shrink-0 text-zinc-300" />
              <span>
                Share → <span className="text-zinc-200">Add to Home Screen</span>
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={installing}
            onClick={() => void handleInstall()}
            className="h-10 bg-orange-500 px-3 font-semibold text-white hover:bg-orange-600"
          >
            <Download className="me-1.5 size-3.5" />
            {isIos ? "Kako?" : installing ? "…" : "Dodaj"}
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Zatvori"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
