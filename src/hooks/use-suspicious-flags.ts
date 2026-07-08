"use client";

import { useCallback, useEffect, useState } from "react";

export type SuspiciousFlagRow = {
  id: string;
  action: string;
  orderId: string | null;
  sessionId: string | null;
  createdAt: string;
  reason: string | null;
  copy: string;
  tableName: string | null;
  orderNumber: number | null;
};

export function useSuspiciousFlags(enabled: boolean) {
  const [flags, setFlags] = useState<SuspiciousFlagRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFlags([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/suspicious-flags?limit=20");
      if (response.status === 403 || response.status === 401) {
        setFlags([]);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Could not load flags.");
        return;
      }

      const body = (await response.json()) as { flags: SuspiciousFlagRow[] };
      setFlags(body.flags ?? []);
    } catch {
      setError("Could not load flags.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { flags, loading, error, refresh };
}

export async function resolveSuspiciousFlagAction(
  eventId: string,
  outcome: "ok" | "problem"
): Promise<{ ok: true } | { error: string }> {
  const response = await fetch(
    `/api/dashboard/suspicious-flags/${eventId}/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { error: body?.error ?? "Could not resolve flag." };
  }

  return { ok: true };
}
