"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useWaiterDenisCopilot } from "@/hooks/use-waiter-denis-copilot";
import { useStaffNotifications } from "@/hooks/use-staff-notifications";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { cn } from "@/lib/utils";

const URGENT_TYPES = new Set([
  "allergy_alert",
  "denis_escalation",
  "waiter_call",
]);

export function WaiterDenisStaffAlerts() {
  const { aiConciergeEnabled } = useDashboard();
  const { data: copilot } = useWaiterDenisCopilot(aiConciergeEnabled);
  const { notifications, unreadCount } = useStaffNotifications();
  const { play } = useSoundAlert();
  const prevUnread = useRef(unreadCount);

  const handoffById = new Map(
    (copilot?.handoffAlerts ?? []).map((alert) => [alert.id, alert])
  );

  const urgentAlerts = useMemo(
    () =>
      notifications.filter(
        (row) => !row.readAt && URGENT_TYPES.has(row.type)
      ),
    [notifications]
  );

  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      const latest = urgentAlerts[0];
      if (latest?.priority === "urgent" || latest?.type === "waiter_call") {
        play(latest.type === "allergy_alert" ? "payment-request" : "waiter-call");
      }
    }
    prevUnread.current = unreadCount;
  }, [unreadCount, urgentAlerts, play]);

  if (urgentAlerts.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dash-text-muted">
        Denis handoff
      </h2>
      {urgentAlerts.slice(0, 5).map((alert) => {
        const enriched = handoffById.get(alert.id);
        const contextLine = enriched?.contextLine ?? alert.message;
        const href =
          alert.actionUrl ??
          (alert.tableId ? `/waiter/tables/${alert.tableId}` : "/waiter/calls");

        return (
          <Link
            key={alert.id}
            href={href}
            className={cn(
              "block rounded-xl border p-4 active:scale-[0.99]",
              alert.type === "allergy_alert"
                ? "border-orange-500/40 bg-orange-500/10"
                : "border-red-500/30 bg-red-500/5"
            )}
          >
            <div className="flex items-start gap-3">
              {alert.type === "allergy_alert" ? (
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-orange-400" />
              ) : (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-dash-text">
                  {alert.tableName ? `Sto ${alert.tableName}` : "Denis alert"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-dash-text-secondary">
                  {contextLine}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
