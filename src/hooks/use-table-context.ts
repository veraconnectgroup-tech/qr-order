"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getOrCreateDeviceFingerprint,
  getStoredDeviceToken,
} from "@/lib/guest/device-storage";
import type { TableGuestContext } from "@/lib/sessions/resolve-table-context";

export function useTableContext(tableToken: string) {
  const [context, setContext] = useState<TableGuestContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const fingerprint = getOrCreateDeviceFingerprint();
    const params = new URLSearchParams({ deviceFingerprint: fingerprint });

    const res = await fetch(
      `/api/tables/${encodeURIComponent(tableToken)}/context?${params}`
    );

    if (!res.ok) {
      setLoading(false);
      return null;
    }

    const json = (await res.json()) as { data?: TableGuestContext };
    const data = json.data ?? null;

    if (data) {
      const storedToken = getStoredDeviceToken(data.locationId, data.tableId);
      if (storedToken && !params.has("deviceToken")) {
        const withToken = new URLSearchParams(params);
        withToken.set("deviceToken", storedToken);
        const res2 = await fetch(
          `/api/tables/${encodeURIComponent(tableToken)}/context?${withToken}`
        );
        if (res2.ok) {
          const json2 = (await res2.json()) as { data?: TableGuestContext };
          setContext(json2.data ?? data);
          setLoading(false);
          return json2.data ?? data;
        }
      }
    }

    setContext(data);
    setLoading(false);
    return data;
  }, [tableToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { context, loading, refresh };
}
