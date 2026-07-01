"use client";

import { readApiErrorMessage } from "@/lib/api-error-client";
import { useCallback, useEffect, useState } from "react";
import type { DenisRoiPayload } from "@/lib/dashboard/denis-roi";

export type DenisRoiRange = "7d" | "30d" | "90d";

export function useDenisRoi(initialRange: DenisRoiRange = "30d") {
  const [range, setRange] = useState<DenisRoiRange>(initialRange);
  const [data, setData] = useState<DenisRoiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/denis-roi?range=${encodeURIComponent(range)}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(readApiErrorMessage(json, res.status, "Could not load Denis ROI."));
        setData(null);
        return;
      }
      setData(json.data as DenisRoiPayload);
    } catch {
      setError("Could not load Denis ROI.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, range, setRange, refresh };
}
