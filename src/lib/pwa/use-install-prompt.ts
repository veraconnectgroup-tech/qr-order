"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa/device";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneMode());
    setIsIos(isIosDevice());

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }

    function onAppInstalled() {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    }

    function onDisplayModeChange() {
      setIsInstalled(isStandaloneMode());
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      mq.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    }
  }, []);

  return {
    /** Native install prompt available (false on iOS). */
    canInstall,
    promptInstall,
    isInstalled,
    /** iOS Safari — show manual Add to Home Screen instructions. */
    isIos,
  };
}
