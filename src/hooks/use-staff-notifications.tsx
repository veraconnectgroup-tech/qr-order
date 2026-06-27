"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { StaffNotificationRow } from "@/lib/denis/notifications/persist-staff-notification";

type StaffNotificationsContextValue = {
  notifications: StaffNotificationRow[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const StaffNotificationsContext =
  createContext<StaffNotificationsContextValue | null>(null);

export function StaffNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locationId, aiConciergeEnabled } = useDashboard();
  const enabled = aiConciergeEnabled && Boolean(locationId);
  const [notifications, setNotifications] = useState<StaffNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled || !locationId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/dashboard/staff-notifications?limit=20`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as {
        notifications: StaffNotificationRow[];
      };
      const rows = body.notifications ?? [];
      setNotifications(rows);
      setUnreadCount(rows.filter((row) => !row.readAt).length);
    } finally {
      setLoading(false);
    }
  }, [enabled, locationId]);

  usePostgresRealtime({
    channelName: `staff-notifications:${locationId}`,
    table: "denis_staff_notifications",
    locationId: locationId ?? "",
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    enabled,
  });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <StaffNotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
      }}
    >
      {children}
    </StaffNotificationsContext.Provider>
  );
}

export function useStaffNotifications() {
  const ctx = useContext(StaffNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useStaffNotifications must be used within StaffNotificationsProvider"
    );
  }
  return ctx;
}
