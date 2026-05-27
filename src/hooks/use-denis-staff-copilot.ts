"use client";

import { useCallback, useEffect, useState } from "react";
import type { StaffCopilotSnapshot } from "@/lib/denis/venue/copilot/types";

const POLL_MS = 30_000;

export function useDenisStaffCopilot() {
  const [data, setData] = useState<StaffCopilotSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard/denis-copilot");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load Denis copilot.");
        setData(null);
        return;
      }
      setData(json.data as StaffCopilotSnapshot);
    } catch {
      setError("Could not load Denis copilot.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { data, loading, error, refresh };
}
