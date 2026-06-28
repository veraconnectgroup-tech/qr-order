"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_GUEST_ACCESSIBILITY,
  mergeAccessibilityPrefs,
  toSceneAccessibility,
  type GuestAccessibilityPrefs,
  type SceneAccessibility,
} from "@/lib/denis/cognition/mental-model/accessibility-types";
import { detectClientAccessibilitySignals } from "@/lib/guest/detect-client-accessibility";

type GuestAccessibilityContextValue = {
  prefs: SceneAccessibility;
  clientSignalsSent: boolean;
  refreshClientSignals: () => void;
  applyRemotePrefs: (prefs: GuestAccessibilityPrefs | null | undefined) => void;
};

const GuestAccessibilityContext =
  createContext<GuestAccessibilityContextValue | null>(null);

export function GuestAccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [clientPrefs, setClientPrefs] = useState<GuestAccessibilityPrefs>(
    DEFAULT_GUEST_ACCESSIBILITY
  );
  const [remotePrefs, setRemotePrefs] =
    useState<GuestAccessibilityPrefs | null>(null);
  const [clientSignalsSent, setClientSignalsSent] = useState(false);

  const refreshClientSignals = useCallback(() => {
    const signals = detectClientAccessibilitySignals();
    setClientPrefs((prev) =>
      mergeAccessibilityPrefs(prev, {
        preferredMode: signals.screenReader ? "simplified" : prev.preferredMode,
        highContrast: signals.screenReader ? true : prev.highContrast,
        fontScale: signals.screenReader
          ? Math.max(prev.fontScale, 1.25)
          : signals.coarsePointer
            ? Math.max(prev.fontScale, 1.25)
            : prev.fontScale,
        reducedMotion: signals.prefersReducedMotion ?? prev.reducedMotion,
      })
    );
    setClientSignalsSent(true);
  }, []);

  useEffect(() => {
    refreshClientSignals();
  }, [refreshClientSignals]);

  const merged = useMemo(
    () =>
      toSceneAccessibility(
        mergeAccessibilityPrefs(clientPrefs, remotePrefs ?? undefined)
      ),
    [clientPrefs, remotePrefs]
  );

  const applyRemotePrefs = useCallback(
    (prefs: GuestAccessibilityPrefs | null | undefined) => {
      setRemotePrefs(prefs ?? null);
    },
    []
  );

  return (
    <GuestAccessibilityContext.Provider
      value={{
        prefs: merged,
        clientSignalsSent,
        refreshClientSignals,
        applyRemotePrefs,
      }}
    >
      {children}
    </GuestAccessibilityContext.Provider>
  );
}

export function useGuestAccessibility() {
  const ctx = useContext(GuestAccessibilityContext);
  if (!ctx) {
    return {
      prefs: toSceneAccessibility(DEFAULT_GUEST_ACCESSIBILITY),
      clientSignalsSent: false,
      refreshClientSignals: () => {},
      applyRemotePrefs: () => {},
    };
  }
  return ctx;
}
