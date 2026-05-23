"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "qr-order-sound";

function playBeep(frequency: number, durationMs: number, volume = 0.12) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + durationMs / 1000
    );
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationMs / 1000);
    osc.onended = () => ctx.close();
  } catch {
    /* ignore */
  }
}

function playNewOrderSound() {
  playBeep(880, 220, 0.18);
  setTimeout(() => playBeep(1100, 280, 0.16), 240);
}

function playWaiterCallSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    osc.type = "sine";
    gain.gain.value = 0.4;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1400;
      gain2.gain.value = 0.4;
      osc2.start();
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3);
    }, 200);
  } catch {
    playBeep(1200, 300, 0.4);
    setTimeout(() => playBeep(1400, 300, 0.4), 200);
  }
}

function playPaymentRequestSound() {
  playBeep(523, 160, 0.2);
  setTimeout(() => playBeep(784, 220, 0.18), 180);
}

type SoundAlertContextValue = {
  enabled: boolean;
  enable: () => void;
  toggle: () => void;
  play: (
    sound: "new-order" | "waiter-call" | "kitchen-order" | "payment-request"
  ) => void;
};

const SoundAlertContext = createContext<SoundAlertContextValue | null>(null);

export function SoundAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      enabledRef.current = true;
      setEnabled(true);
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    if (next) playBeep(880, 120);
  }, []);

  const enable = useCallback(() => {
    if (!enabledRef.current) toggle();
  }, [toggle]);

  const play = useCallback(
    (
      sound: "new-order" | "waiter-call" | "kitchen-order" | "payment-request"
    ) => {
      if (!enabledRef.current) return;

      const audio = new Audio(`/sounds/${sound}.mp3`);
      audio.play().catch(() => {
        if (sound === "new-order") playNewOrderSound();
        else if (sound === "kitchen-order") {
          playBeep(660, 180);
          setTimeout(() => playBeep(880, 220), 200);
          setTimeout(() => playBeep(990, 180), 400);
        } else if (sound === "payment-request") playPaymentRequestSound();
        else playWaiterCallSound();
      });
    },
    []
  );

  return (
    <SoundAlertContext.Provider value={{ enabled, enable, toggle, play }}>
      {children}
    </SoundAlertContext.Provider>
  );
}

export function useSoundAlert() {
  const ctx = useContext(SoundAlertContext);
  if (!ctx) {
    throw new Error("useSoundAlert must be used within SoundAlertProvider");
  }
  return ctx;
}
