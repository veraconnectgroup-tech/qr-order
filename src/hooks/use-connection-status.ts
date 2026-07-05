"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionStatus = "online" | "degraded" | "offline";

const HEALTH_PING_INTERVAL_MS = 30_000;
const HEALTH_PING_TIMEOUT_MS = 8_000;

async function pingHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_PING_TIMEOUT_MS);

  try {
    const res = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useConnectionStatus() {
  // Must match on the server (no `navigator`) and the client's first paint,
  // or React throws a hydration mismatch — the real value is only known
  // after mount, so start optimistic here and let the mount effect below
  // correct it within milliseconds.
  const [status, setStatus] = useState<ConnectionStatus>("online");
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const [secondsOffline, setSecondsOffline] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const evaluate = useCallback(async () => {
    if (typeof navigator === "undefined") return;

    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }

    const healthy = await pingHealth();
    if (!healthy) {
      setStatus("degraded");
      return;
    }

    setStatus("online");
    setLastOnlineAt(new Date());
  }, []);

  useEffect(() => {
    void evaluate();

    const onOnline = () => void evaluate();
    const onOffline = () => setStatus("offline");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const intervalId = setInterval(() => void evaluate(), HEALTH_PING_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(intervalId);
    };
  }, [evaluate]);

  useEffect(() => {
    if (status !== "offline") {
      setSecondsOffline(0);
      return;
    }

    const tick = setInterval(() => {
      setSecondsOffline((s) => s + 1);
    }, 1000);

    return () => clearInterval(tick);
  }, [status]);

  return { status, lastOnlineAt, secondsOffline, recheck: evaluate, isOnline: status === "online" };
}
