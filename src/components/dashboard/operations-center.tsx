"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PriorityBadge } from "@/components/dashboard/denis-staff-copilot-parts";
import { useDenisStaffCopilot } from "@/hooks/use-denis-staff-copilot";
import { useLocationStationQuestions } from "@/hooks/use-location-station-questions";
import { useOperationsReadyStates } from "@/hooks/use-operations-ready-states";
import {
  useRealtimeWaiterCalls,
  type WaiterCallWithTable,
} from "@/hooks/use-realtime-waiter-calls";
import { useStaffNotifications } from "@/hooks/use-staff-notifications";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { remindWaiterForReadyStationAction } from "@/lib/dashboard/operations-actions";
import {
  DEFAULT_READY_STUCK_MINUTES,
  filterBurningNotifications,
  filterOpenServiceRecoveryNotifications,
  filterReadyStuckRows,
  filterRiskPriorityTables,
  formatExpiryCountdown,
  secondsUntilExpiry,
  stationLabel,
  stationSurfaceHref,
} from "@/lib/dashboard/operations-triage";
import { markStaffNotificationReadAction } from "@/lib/dashboard/staff-notification-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SectionShell({
  tone,
  title,
  count,
  children,
}: {
  tone: "red" | "orange" | "amber" | "blue" | "neutral";
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const border =
    tone === "red"
      ? "border-red-500/30"
      : tone === "orange"
        ? "border-orange-500/30"
        : tone === "amber"
          ? "border-amber-500/30"
          : tone === "blue"
            ? "border-blue-500/30"
            : "border-dash-border";

  return (
    <section className={cn("rounded-xl border bg-dash-surface/40 p-4", border)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-dash-text">{title}</h2>
        {count > 0 && (
          <span className="rounded-full bg-dash-surface-raised px-2.5 py-0.5 text-xs font-semibold text-dash-text-secondary">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50",
        variant === "primary"
          ? "bg-dash-accent text-white"
          : "bg-dash-surface-raised text-dash-text-secondary hover:text-dash-text"
      )}
    >
      {children}
    </button>
  );
}

function ActionLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
        variant === "primary"
          ? "bg-dash-accent text-white"
          : "bg-dash-surface-raised text-dash-text-secondary hover:text-dash-text"
      )}
    >
      {children}
    </Link>
  );
}

export function OperationsCenter() {
  const { locationId, staffName, aiConciergeEnabled } = useDashboard();
  const { notifications, loading: notifLoading, refresh: refreshNotifs } =
    useStaffNotifications();
  const { data: copilot, loading: copilotLoading } = useDenisStaffCopilot();
  const { questions, loading: questionsLoading, refetch: refetchQuestions } =
    useLocationStationQuestions(locationId);
  const { rows: readyRows, loading: readyLoading, refetch: refetchReady } =
    useOperationsReadyStates(locationId);
  const { calls, loading: callsLoading, refetch: refetchCalls } =
    useRealtimeWaiterCalls(locationId);
  const { refreshAlerts } = useDashboardAlerts();
  const [pending, startTransition] = useTransition();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);

  void tick;

  const burning = useMemo(
    () => filterBurningNotifications(notifications),
    [notifications]
  );
  const openRecovery = useMemo(
    () => filterOpenServiceRecoveryNotifications(notifications),
    [notifications]
  );
  const riskTables = useMemo(
    () => filterRiskPriorityTables(copilot?.priorityTables ?? []),
    [copilot?.priorityTables]
  );
  const readyStuck = useMemo(
    () => filterReadyStuckRows(readyRows, DEFAULT_READY_STUCK_MINUTES),
    [readyRows]
  );
  const pendingCalls = useMemo(
    () => calls.filter((call) => call.status === "pending"),
    [calls]
  );

  const loading =
    notifLoading ||
    copilotLoading ||
    questionsLoading ||
    readyLoading ||
    callsLoading;

  const hasWork =
    burning.length > 0 ||
    openRecovery.length > 0 ||
    questions.length > 0 ||
    readyStuck.length > 0 ||
    riskTables.length > 0 ||
    pendingCalls.length > 0;

  function markNotificationResolved(id: string) {
    startTransition(async () => {
      const result = await markStaffNotificationReadAction(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      await refreshNotifs();
    });
  }

  async function escalateStationQuestion(input: {
    orderId: string | null;
    station: "kitchen" | "bar";
  }) {
    if (!input.orderId) {
      toast.error("Nema order ID za eskalaciju.");
      return;
    }

    const response = await fetch("/api/station-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: input.orderId,
        station: input.station,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(body?.error ?? "Eskalacija nije uspela.");
      return;
    }

    toast.success("Denis ponovo pita stanicu.");
    await refetchQuestions();
  }

  function remindWaiter(orderId: string, station: "kitchen" | "bar") {
    startTransition(async () => {
      const result = await remindWaiterForReadyStationAction({
        orderId,
        station,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Podsetnik poslat konobarima.");
    });
  }

  async function updateWaiterCall(
    id: string,
    status: "acknowledged" | "resolved"
  ) {
    const supabase = createClient();
    const now = new Date().toISOString();
    const updates =
      status === "acknowledged"
        ? { status, acknowledged_at: now }
        : { status, resolved_at: now };

    const { error } = await supabase
      .from("waiter_calls")
      .update(updates as never)
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await refreshAlerts();
    await refetchCalls();
  }

  if (!aiConciergeEnabled) {
    return (
      <div className="mx-auto max-w-3xl py-24 text-center">
        <p className="text-lg text-dash-text-muted">
          Operations Center zahteva Denis concierge na ovoj lokaciji.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-32 rounded-xl bg-dash-surface-raised"
          />
        ))}
      </div>
    );
  }

  if (!hasWork) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-24 text-center">
        <CheckCircle2 className="size-16 text-emerald-400/80" />
        <p className="mt-4 text-2xl font-semibold text-dash-text">
          Sve mirno ✓
        </p>
        <p className="mt-2 max-w-md text-sm text-dash-text-muted">
          Nema hitnih Denis obaveštenja, otvorenih pitanja stanica, zaglavljenih
          spremnih porudžbina, rizičnih stolova ni poziva konobara.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      {openRecovery.length > 0 && (
        <SectionShell
          tone="red"
          title="🩹 Service recovery"
          count={openRecovery.length}
        >
          {openRecovery.map((notification) => (
            <article
              key={notification.id}
              className="rounded-lg border border-red-500/25 bg-red-500/5 p-4"
            >
              <p className="text-sm font-medium text-dash-text">
                {notification.tableName
                  ? `${notification.tableName} — ${notification.message}`
                  : notification.message}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <ActionButton
                  disabled={pending}
                  onClick={() => markNotificationResolved(notification.id)}
                >
                  Označi rešeno
                </ActionButton>
                {notification.actionUrl && (
                  <ActionLink href={notification.actionUrl}>Otvori sto</ActionLink>
                )}
              </div>
            </article>
          ))}
        </SectionShell>
      )}

      {burning.length > 0 && (
        <SectionShell tone="red" title="🔴 Gori sada" count={burning.length}>
          {burning.map((notification) => (
            <article
              key={notification.id}
              className="rounded-lg border border-red-500/25 bg-red-500/5 p-4"
            >
              <p className="text-sm font-medium text-dash-text">
                {notification.tableName
                  ? `${notification.tableName} — ${notification.message}`
                  : notification.message}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <ActionButton
                  disabled={pending}
                  onClick={() => markNotificationResolved(notification.id)}
                >
                  Označi rešeno
                </ActionButton>
                {notification.actionUrl && (
                  <ActionLink href={notification.actionUrl}>
                    Otvori
                  </ActionLink>
                )}
              </div>
            </article>
          ))}
        </SectionShell>
      )}

      {questions.length > 0 && (
        <SectionShell
          tone="orange"
          title="🟠 Čeka odgovor"
          count={questions.length}
        >
          {questions.map((question) => {
            const countdown = formatExpiryCountdown(
              secondsUntilExpiry(question.expires_at)
            );

            return (
              <article
                key={question.id}
                className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-dash-text">
                    {stationLabel(question.station)} — {question.message}
                  </p>
                  <span className="shrink-0 text-xs font-semibold text-orange-300">
                    {countdown}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <ActionLink href={stationSurfaceHref(question.station)}>
                    Idi na {stationLabel(question.station).toLowerCase()}
                  </ActionLink>
                  <ActionButton
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void escalateStationQuestion({
                        orderId: question.order_id,
                        station: question.station,
                      })
                    }
                  >
                    Eskaliraj
                  </ActionButton>
                </div>
              </article>
            );
          })}
        </SectionShell>
      )}

      {readyStuck.length > 0 && (
        <SectionShell
          tone="amber"
          title="🟡 Spremno a stoji"
          count={readyStuck.length}
        >
          {readyStuck.map((row) => {
            const label =
              row.orderNumber != null ? `Bon #${row.orderNumber}` : "Porudžbina";
            const table = row.tableName ? `Sto ${row.tableName}` : "Sto";

            return (
              <article
                key={`${row.orderId}:${row.station}`}
                className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4"
              >
                <p className="text-sm font-medium text-dash-text">
                  {table} · {label} — {stationLabel(row.station).toLowerCase()}{" "}
                  spremno {row.waitMinutes} min
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <ActionButton
                    disabled={pending}
                    onClick={() => remindWaiter(row.orderId, row.station)}
                  >
                    Podseti konobara
                  </ActionButton>
                  <ActionLink href="/dashboard/orders">Otvori porudžbinu</ActionLink>
                </div>
              </article>
            );
          })}
        </SectionShell>
      )}

      {riskTables.length > 0 && (
        <SectionShell
          tone="blue"
          title="🔵 Stolovi u riziku"
          count={riskTables.length}
        >
          {riskTables.map((table) => (
            <article
              key={table.tableId}
              className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-dash-text">
                  {table.tableName}
                </p>
                <PriorityBadge priority={table.priority} />
              </div>
              {table.staffBrief && (
                <p className="mt-2 text-sm text-dash-text-muted">
                  {table.staffBrief}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <ActionLink href="/dashboard/tables">Otvori sto</ActionLink>
                <ActionLink href="/dashboard/denis" variant="secondary">
                  Denis floor
                </ActionLink>
              </div>
            </article>
          ))}
        </SectionShell>
      )}

      {pendingCalls.length > 0 && (
        <SectionShell
          tone="neutral"
          title="⚪ Pozivi konobara"
          count={pendingCalls.length}
        >
          {pendingCalls.map((call: WaiterCallWithTable) => {
            const tableName = call.tables?.name ?? "Sto";
            return (
              <article
                key={call.id}
                className="rounded-lg border border-dash-border bg-dash-bg/60 p-4"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-dash-text">
                  <Bell className="size-4 text-red-400" />
                  {tableName}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <ActionButton
                    onClick={() => updateWaiterCall(call.id, "acknowledged")}
                  >
                    {staffName.split(" ")[0] ?? staffName} ide
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    onClick={() => updateWaiterCall(call.id, "resolved")}
                  >
                    Rešeno
                  </ActionButton>
                  <ActionLink href="/dashboard/waiter-calls">Svi pozivi</ActionLink>
                </div>
              </article>
            );
          })}
        </SectionShell>
      )}
    </div>
  );
}
