"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissDashboardBanner,
  isDashboardBannerDismissed,
} from "@/lib/pwa/dismiss";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";

function IosInstallHint() {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg bg-blue-950/40 px-3 py-2">
      <div
        className="flex shrink-0 flex-col items-center gap-0.5 text-blue-200"
        aria-hidden
      >
        <div className="flex size-9 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-900/50">
          <Share className="size-4" />
        </div>
        <span className="text-[10px] leading-none">Share</span>
      </div>
      <span className="text-blue-300/70">→</span>
      <div
        className="flex shrink-0 flex-col items-center gap-0.5 text-blue-200"
        aria-hidden
      >
        <div className="flex size-9 items-center justify-center rounded-lg border border-orange-400/40 bg-orange-500/20">
          <span className="text-lg leading-none">+</span>
        </div>
        <span className="text-[10px] leading-none">Home</span>
      </div>
      <p className="text-xs leading-snug text-blue-100/90">
        Tap <span className="font-medium">Share</span>{" "}
        <span aria-hidden>⬆️</span> →{" "}
        <span className="font-medium">Add to Home Screen</span>
      </p>
    </div>
  );
}

export function PwaInstallBanner() {
  const { canInstall, promptInstall, isInstalled, isIos } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setDismissed(isDashboardBannerDismissed());
  }, []);

  const showBanner =
    !isInstalled && !dismissed && (canInstall || isIos);

  if (!showBanner) return null;

  function handleLater() {
    dismissDashboardBanner();
    setDismissed(true);
  }

  async function handleInstall() {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Install app"
      className="border-b border-blue-500/30 bg-gradient-to-r from-blue-600/90 to-orange-500/80 px-4 py-3 text-white shadow-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">
            Instaliraj QR Order za brži pristup bez browser bara
          </p>
          {isIos && <IosInstallHint />}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canInstall && (
            <Button
              type="button"
              size="sm"
              disabled={installing}
              onClick={handleInstall}
              className="h-9 bg-white font-semibold text-blue-700 hover:bg-blue-50"
            >
              <Download className="mr-1.5 size-4" />
              {installing ? "…" : "Instaliraj"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleLater}
            className="h-9 text-white/90 hover:bg-white/15 hover:text-white"
          >
            Kasnije
          </Button>
          <button
            type="button"
            onClick={handleLater}
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white sm:hidden"
            aria-label="Zatvori"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
