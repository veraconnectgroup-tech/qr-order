"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { StaffNotificationRow } from "@/lib/denis/notifications/persist-staff-notification";

export function useDenisActivityFeed(initial?: StaffNotificationRow[]) {
  const { locationId, aiConciergeEnabled } = useDashboard();
  const enabled = aiConciergeEnabled && Boolean(locationId);
  const [loading, setLoading] = useState(!initial?.length);
  const [items, setItems] = useState<StaffNotificationRow[]>(initial ?? []);

  const refresh = useCallback(async () => {
    if (!enabled || !locationId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const response = await fetch(
      `/api/dashboard/staff-notifications?limit=12`,
      { cache: "no-store" }
    );
    if (!response.ok) return;

    const body = (await response.json()) as {
      notifications: StaffNotificationRow[];
    };
    setItems(body.notifications ?? []);
  }, [enabled, locationId]);

  useEffect(() => {
    if (initial?.length) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, initial?.length]);

  usePostgresRealtime({
    channelName: `denis-activity:${locationId}`,
    table: "denis_staff_notifications",
    locationId: locationId ?? "",
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    enabled,
  });

  return { loading, items, refresh };
}
