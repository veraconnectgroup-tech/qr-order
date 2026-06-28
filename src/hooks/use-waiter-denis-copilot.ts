"use client";

import { useCallback, useEffect, useState } from "react";
import type { WaiterCopilotSnapshot } from "@/lib/denis/venue/copilot/waiter-copilot-types";

const POLL_MS = 30_000;

export function useWaiterDenisCopilot(enabled = true) {
  const [data, setData] = useState<WaiterCopilotSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/waiter/denis-copilot", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load Denis copilot.");
        setData(null);
        return;
      }
      setData(json.data as WaiterCopilotSnapshot);
    } catch {
      setError("Could not load Denis copilot.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return undefined;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
