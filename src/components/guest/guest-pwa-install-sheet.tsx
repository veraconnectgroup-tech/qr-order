"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  dismissGuestPrompt,
  isGuestPromptDismissed,
} from "@/lib/pwa/dismiss";
import { isStandaloneMode } from "@/lib/pwa/device";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";

const GUEST_PROMPT_DELAY_MS = 2 * 60 * 1000;

export function GuestPwaInstallSheet() {
  const { canInstall, promptInstall, isInstalled, isIos } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInstalled || isGuestPromptDismissed()) return;
    if (!canInstall && !isIos) return;

    const timer = window.setTimeout(() => {
      if (!isGuestPromptDismissed() && !isStandaloneMode()) {
        setOpen(true);
      }
    }, GUEST_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [canInstall, isInstalled, isIos]);

  function handleDismiss() {
    dismissGuestPrompt();
    setOpen(false);
  }

  async function handleInstall() {
    if (!canInstall) return;
    setInstalling(true);
    try {
      await promptInstall();
      dismissGuestPrompt();
      setOpen(false);
    } finally {
      setInstalling(false);
    }
  }

  if (isInstalled) return null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && handleDismiss()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="guest-theme rounded-t-2xl border-zinc-800 bg-zinc-900 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
      >
        <SheetHeader className="text-left">
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-orange-500/15">
            <Smartphone className="size-5 text-orange-400" />
          </div>
          <SheetTitle className="text-zinc-50">
            Add to Home Screen for easier access
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            {isIos
              ? "Tap Share ⬆️ → Add to Home Screen for quicker menu access."
              : "Install the app for faster ordering without the browser bar."}
          </SheetDescription>
        </SheetHeader>

        {isIos && (
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-800">
              <Share className="size-4 text-zinc-300" />
            </div>
            <span className="text-zinc-500">→</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/20">
              <span className="text-lg text-orange-300">+</span>
            </div>
            <p className="text-sm text-zinc-400">
              Share → <span className="text-zinc-200">Add to Home Screen</span>
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {canInstall && (
            <Button
              type="button"
              disabled={installing}
              onClick={handleInstall}
              className="h-12 flex-1 rounded-xl bg-orange-500 font-semibold hover:bg-orange-600"
            >
              <Download className="mr-2 size-4" />
              {installing ? "…" : "Install"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleDismiss}
            className="h-12 flex-1 rounded-xl border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800"
          >
            Not now
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
