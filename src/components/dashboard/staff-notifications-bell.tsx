"use client";

import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useStaffNotifications } from "@/hooks/use-staff-notifications";
import {
  markAllStaffNotificationsReadAction,
  markStaffNotificationReadAction,
} from "@/lib/dashboard/staff-notification-actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function priorityClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "border-red-500/40 bg-red-500/10";
    case "high":
      return "border-amber-500/40 bg-amber-500/10";
    default:
      return "border-dash-border bg-dash-surface";
  }
}

export function StaffNotificationsBell({ compact = false }: { compact?: boolean }) {
  const { notifications, unreadCount, refresh, loading } = useStaffNotifications();
  const [pending, startTransition] = useTransition();
  const prevUnreadRef = useRef(0);
  const readyRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (readyRef.current && unreadCount > prevUnreadRef.current) {
      const latest = notifications.find((row) => !row.readAt);
      toast.info(
        latest?.tableName
          ? `Denis — ${latest.tableName}: ${latest.message}`
          : `Denis alert — ${latest?.message ?? "New staff notification"}`,
        { duration: 5000 }
      );
    }

    prevUnreadRef.current = unreadCount;
    readyRef.current = true;
  }, [loading, notifications, unreadCount]);

  function markRead(id: string) {
    startTransition(async () => {
      const result = await markStaffNotificationReadAction(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      await refresh();
    });
  }

  function markAllRead() {
    startTransition(async () => {
      const result = await markAllStaffNotificationsReadAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      await refresh();
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={
            compact
              ? "relative size-8 text-dash-text-muted hover:text-dash-text"
              : "relative size-9 text-dash-text-muted hover:text-dash-text"
          }
          aria-label="Denis staff notifications"
        >
          <Bell className={compact ? "size-4" : "size-4.5"} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5">
              <NavNotificationBadge count={unreadCount} />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] border-dash-border bg-dash-bg p-0"
      >
        <div className="flex items-center justify-between border-b border-dash-border-subtle px-3 py-2.5">
          <p className="text-sm font-semibold text-dash-text">Denis alerts</p>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              className="h-7 text-xs"
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {notifications.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-dash-text-muted">
              No Denis alerts yet.
            </li>
          ) : (
            notifications.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "mb-2 rounded-lg border px-3 py-2.5 text-sm last:mb-0",
                  priorityClass(row.priority),
                  !row.readAt && "ring-1 ring-dash-accent/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-dash-text">
                      {row.tableName ? `${row.tableName} · ` : ""}
                      {row.message}
                    </p>
                    <p className="mt-0.5 text-[11px] text-dash-text-muted">
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!row.readAt && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      disabled={pending}
                      onClick={() => markRead(row.id)}
                    >
                      Read
                    </Button>
                  )}
                </div>
                {row.actionUrl && (
                  <Link
                    href={row.actionUrl}
                    className="mt-2 inline-block text-xs font-medium text-dash-accent hover:underline"
                    onClick={() => {
                      if (!row.readAt) markRead(row.id);
                    }}
                  >
                    Open →
                  </Link>
                )}
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
