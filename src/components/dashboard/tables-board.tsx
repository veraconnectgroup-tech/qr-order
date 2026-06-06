"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Plus, RefreshCw, ArrowRightLeft, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useAppBaseUrl } from "@/hooks/use-app-base-url";
import { guestTableUrl, isUnsafeGuestBaseUrl } from "@/lib/app-url";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { TransferDialog } from "@/components/dashboard/transfer-dialog";
import { TableBillPanel } from "@/components/dashboard/table-bill-panel";
import { TableSessionHistory } from "@/components/dashboard/table-session-history";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FloorTile } from "@/components/design-system";
import { tableTileStatus } from "@/lib/dashboard/table-tile-status";
import {
  isActiveTableOrder,
  orderHasPaymentRequest,
} from "@/lib/dashboard/table-active-orders";
import {
  buildQrTableCardPrintHtml,
  generateTableQrDataUrl,
  openQrTableCardPrintWindow,
  prepareQrTableCardItems,
  resolveQrTableCardLocale,
} from "@/lib/print/qr-table-card-print";
import { wt } from "@/lib/i18n/waiter-app-ui";
import { cn } from "@/lib/utils";
import type { Order, Table, TableSession, Zone } from "@/types";

type TableOrder = Pick<
  Order,
  "id" | "order_number" | "total" | "status" | "payment_requested_at" | "payment_status" | "payment_method"
>;

type TableRow = Table & {
  zone: Zone | null;
  session: Pick<TableSession, "id" | "opened_at"> | null;
  activeOrders: TableOrder[];
  sessionTotal: number;
  hasWaiterCall: boolean;
  hasPaymentRequest: boolean;
};

function formatDuration(since: string) {
  const ms = Date.now() - new Date(since).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function TableSessionTimer({ openedAt }: { openedAt: string }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="mt-1 font-mono text-xs tabular-nums text-emerald-400/90">
      {formatDuration(openedAt)}
    </p>
  );
}

function orderStatusLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered ✓";
    case "preparing":
    case "accepted":
      return "Preparing ⟳";
    case "ready":
      return "Ready";
    case "rejected":
      return "Rejected";
    default:
      return "New";
  }
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}


export function TablesBoard() {
  const { locationId, orgId, orgSlug: contextOrgSlug, orgName, currency, menuLocale } =
    useDashboard();
  const appUrl = useAppBaseUrl();
  const [resolvedOrgSlug, setResolvedOrgSlug] = useState(contextOrgSlug);
  const guestUrlUnsafe = isUnsafeGuestBaseUrl(appUrl);
  const waiterCallsResult = useRealtimeWaiterCalls(locationId);
  const waiterCalls = waiterCallsResult.calls;
  const [tables, setTables] = useState<TableRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZone, setActiveZone] = useState<string>("all");
  const isHistoryView = activeZone === "history";
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [newTable, setNewTable] = useState({ name: "", zoneId: "", seats: 4 });
  const [newZoneName, setNewZoneName] = useState("");

  const pendingCallTableIds = useMemo(
    () =>
      new Set(
        waiterCalls.filter((c) => c.status === "pending").map((c) => c.table_id)
      ),
    [waiterCalls]
  );

  useEffect(() => {
    setResolvedOrgSlug(contextOrgSlug);
    if (contextOrgSlug) return;

    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .maybeSingle()
      .then(({ data }) => {
        const slug = (data as { slug: string } | null)?.slug?.trim();
        if (!cancelled && slug) setResolvedOrgSlug(slug);
      });

    return () => {
      cancelled = true;
    };
  }, [contextOrgSlug, orgId]);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [
      { data: zonesData },
      { data: tablesData },
      { data: sessions },
      { data: orders },
    ] = await Promise.all([
      supabase
        .from("zones")
        .select("*")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("tables")
        .select("*, zone:zones(*)")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("table_sessions")
        .select("id, table_id, opened_at")
        .eq("location_id", locationId)
        .eq("status", "active"),
      supabase
        .from("orders")
        .select(
          "id, table_id, session_id, order_number, total, status, created_at, payment_requested_at, payment_status, payment_method"
        )
        .eq("location_id", locationId)
        .gte("created_at", startOfTodayIso())
        .neq("status", "rejected"),
    ]);

    const sessionMap = new Map(
      (sessions ?? []).map((s) => [
        (s as { table_id: string }).table_id,
        s as Pick<TableSession, "id" | "opened_at">,
      ])
    );

    const ordersByTable = new Map<string, TableOrder[]>();
    for (const o of orders ?? []) {
      const row = o as TableOrder & {
        table_id: string | null;
        session_id: string | null;
      };
      if (!row.table_id) continue;

      const session = sessionMap.get(row.table_id) ?? null;
      if (!isActiveTableOrder(row, session)) continue;

      const list = ordersByTable.get(row.table_id) ?? [];
      list.push(row);
      ordersByTable.set(row.table_id, list);
    }

    const enriched: TableRow[] = (
      (tablesData ?? []) as unknown as Array<Table & { zone: Zone | null }>
    ).map((t) => {
      const session = sessionMap.get(t.id) ?? null;
      const activeOrders = (ordersByTable.get(t.id) ?? []).sort(
        (a, b) => b.order_number - a.order_number
      );
      const sessionTotal = activeOrders.reduce(
        (sum, o) => sum + Number(o.total),
        0
      );
      const hasPaymentRequest =
        session != null &&
        activeOrders.some((o) => orderHasPaymentRequest(o));
      return {
        ...t,
        zone: t.zone,
        session,
        activeOrders,
        sessionTotal,
        hasWaiterCall: pendingCallTableIds.has(t.id),
        hasPaymentRequest,
      };
    });

    setZones((zonesData as Zone[]) ?? []);
    setTables(enriched);
    setLoading(false);
  }, [locationId, pendingCallTableIds]);

  useEffect(() => {
    load();
  }, [load]);

  usePostgresRealtime({
    channelName: `tables-board-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: load,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  const zoneTabs = useMemo(() => {
    const countByZone = new Map<string, number>();
    for (const table of tables) {
      if (!table.zone_id) continue;
      countByZone.set(
        table.zone_id,
        (countByZone.get(table.zone_id) ?? 0) + 1
      );
    }
    return zones
      .map((zone) => ({
        id: zone.id,
        name: zone.name,
        count: countByZone.get(zone.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [zones, tables]);

  const filtered = useMemo(() => {
    if (activeZone === "all") return tables;
    return tables.filter((t) => t.zone_id === activeZone);
  }, [tables, activeZone]);

  const groupedTables = useMemo(() => {
    if (activeZone !== "all") {
      const zone = zones.find((z) => z.id === activeZone);
      return [
        {
          zoneId: activeZone,
          zoneName: zone?.name ?? "Zone",
          tables: filtered,
        },
      ];
    }

    const groups: Array<{
      zoneId: string | null;
      zoneName: string;
      tables: TableRow[];
    }> = [];

    for (const zone of zoneTabs) {
      const zoneTables = filtered.filter((t) => t.zone_id === zone.id);
      if (zoneTables.length > 0) {
        groups.push({
          zoneId: zone.id,
          zoneName: zone.name,
          tables: zoneTables,
        });
      }
    }

    const unassigned = filtered.filter((t) => !t.zone_id);
    if (unassigned.length > 0) {
      groups.push({
        zoneId: null,
        zoneName: "Unassigned",
        tables: unassigned,
      });
    }

    return groups;
  }, [activeZone, filtered, zoneTabs, zones]);

  useEffect(() => {
    if (!selected) {
      setQrUrl(null);
      return;
    }
    const url = guestTableUrl(resolvedOrgSlug, selected.qr_token, appUrl);
    generateTableQrDataUrl(url, 200).then(setQrUrl);
  }, [selected, appUrl, resolvedOrgSlug]);

  async function regenerateToken(tableId: string) {
    const supabase = createClient();
    const newToken = crypto.randomUUID();
    const { error } = await supabase
      .from("tables")
      .update({ qr_token: newToken })
      .eq("id", tableId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("QR token regenerated");
    if (selected?.id === tableId) {
      setSelected((s) => (s ? { ...s, qr_token: newToken } : null));
    }
    load();
  }

  async function closeSession(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}/close`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(
        (json as { error?: string }).error ?? "Could not close table session"
      );
      return;
    }
    toast.success("Table session closed");
    setSelected(null);
    load();
  }

  async function addZone() {
    const name = newZoneName.trim();
    if (!name) {
      toast.error("Enter a zone name");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("zones")
      .insert({
        location_id: locationId,
        name,
        sort_order: zones.length,
        is_active: true,
      })
      .select("id, name")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Zone "${name}" added`);
    setNewZoneName("");
    if (data) {
      const row = data as { id: string; name: string };
      setNewTable((t) => ({ ...t, zoneId: row.id }));
      setActiveZone(row.id);
    }
    load();
  }

  async function removeZone(zoneId: string) {
    const tableCount = tables.filter((t) => t.zone_id === zoneId).length;
    if (tableCount > 0) {
      toast.error("Move or remove tables in this zone first");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("zones").delete().eq("id", zoneId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Zone removed");
    if (activeZone === zoneId) setActiveZone("all");
    load();
  }

  function openAddTable() {
    if (zones.length === 0) {
      toast.message("Create a zone first (e.g. Terrace, Bar, Zone 1)");
      setZonesOpen(true);
      return;
    }
    setNewTable({ name: "", zoneId: zones[0]?.id ?? "", seats: 4 });
    setAddOpen(true);
  }

  async function addTable() {
    if (!newTable.name.trim() || !newTable.zoneId) {
      toast.error("Name and zone are required");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("tables").insert({
      location_id: locationId,
      zone_id: newTable.zoneId,
      name: newTable.name.trim(),
      seats: newTable.seats,
      qr_token: crypto.randomUUID(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Table added");
    setAddOpen(false);
    setNewTable({ name: "", zoneId: zones[0]?.id ?? "", seats: 4 });
    load();
  }

  async function downloadAllQrCodes() {
    const items = await prepareQrTableCardItems(
      tables.map((table) => ({
        tableName: table.name,
        zoneName: table.zone?.name,
        scanUrl: guestTableUrl(resolvedOrgSlug, table.qr_token, appUrl),
      }))
    );

    const html = buildQrTableCardPrintHtml({
      venueName: orgName,
      items,
      locale: resolveQrTableCardLocale(menuLocale),
      autoPrint: true,
    });

    const win = openQrTableCardPrintWindow(html);
    if (!win) {
      toast.error("Allow pop-ups to download QR codes");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg bg-dash-surface-raised" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-dash-surface-raised" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex gap-3 overflow-x-auto border-b border-dash-border pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-4 sm:overflow-visible">
          <button
            type="button"
            onClick={() => {
              setActiveZone("all");
              setSelected(null);
            }}
            className={cn(
              "pb-2 text-sm font-medium transition",
              activeZone === "all"
                ? "border-b-2 border-dash-accent text-white"
                : "text-dash-text-muted hover:text-white"
            )}
          >
            All ({tables.length})
          </button>
          {zoneTabs.map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => {
                setActiveZone(zone.id);
                setSelected(null);
              }}
              className={cn(
                "pb-2 text-sm font-medium transition",
                activeZone === zone.id
                  ? "border-b-2 border-dash-accent text-white"
                  : "text-dash-text-muted hover:text-white"
              )}
            >
              {zone.name} ({zone.count})
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setActiveZone("history");
              setSelected(null);
            }}
            className={cn(
              "pb-2 text-sm font-medium transition",
              activeZone === "history"
                ? "border-b-2 border-dash-accent text-white"
                : "text-dash-text-muted hover:text-white"
            )}
          >
            Istorija
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setNewZoneName("");
              setZonesOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dash-surface-overlay bg-dash-surface px-3 py-2 text-xs font-medium text-dash-text-secondary transition hover:border-dash-surface-overlay hover:bg-dash-surface-raised sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Plus className="size-4" />
            Zones
          </button>
          <button
            type="button"
            onClick={downloadAllQrCodes}
            className="rounded-lg bg-dash-surface-raised px-3 py-2 text-xs text-dash-text-secondary transition hover:bg-dash-surface-overlay sm:px-4 sm:text-sm"
          >
            <span className="hidden sm:inline">Download All QR Codes</span>
            <span className="sm:hidden">All QR</span>
          </button>
          <button
            type="button"
            onClick={openAddTable}
            className="inline-flex items-center gap-1.5 rounded-lg bg-dash-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-dash-accent-hover sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Plus className="size-4" />
            Add Table
          </button>
        </div>
      </div>

      {isHistoryView ? (
        <TableSessionHistory onReopened={load} />
      ) : (
        <>
      {zones.length === 0 && (
        <div className="mb-6 rounded-xl border border-dashed border-dash-surface-overlay bg-dash-surface/50 px-4 py-8 text-center">
          <p className="font-medium text-dash-text-secondary">No zones yet</p>
          <p className="mt-1 text-sm text-dash-text-disabled">
            Add areas like Terrace, Bar, or Zone 1–5, then assign tables to each zone.
          </p>
          <button
            type="button"
            onClick={() => setZonesOpen(true)}
            className="mt-4 rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover"
          >
            Add your first zone
          </button>
        </div>
      )}

      {groupedTables.map((group) => (
        <section key={group.zoneId ?? "unassigned"} className="mb-8 last:mb-0">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-dash-text-secondary">
              {group.zoneName}
            </h3>
            <span className="rounded-full bg-dash-surface-raised px-2 py-0.5 text-[10px] font-semibold tabular-nums text-dash-text-muted">
              {group.tables.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
            {group.tables.map((table) => {
              const status = tableTileStatus(table);
              const isActive = status !== "available";

              return (
                <FloorTile
                  key={table.id}
                  as="button"
                  variant="floor"
                  status={status}
                  label={table.name}
                  sublabel={`${table.seats} seats`}
                  onClick={() => setSelected(table)}
                  className={status === "occupied" ? "animate-pulse" : undefined}
                >
                  {table.session && (
                    <TableSessionTimer openedAt={table.session.opened_at} />
                  )}
                  {status === "attention" ? (
                    <p className="mt-2 text-sm text-red-400">
                      <span className="mr-1 inline-block size-2 rounded-full bg-red-500" />
                      Needs attention
                    </p>
                  ) : status === "payment" ? (
                    <p className="mt-2 text-sm text-amber-400">
                      <span className="mr-1 inline-block size-2 rounded-full bg-amber-500" />
                      Payment requested
                    </p>
                  ) : isActive ? (
                    <>
                      <p className="mt-2 text-sm text-emerald-400">
                        <span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />
                        Occupied
                      </p>
                      {table.sessionTotal > 0 && (
                        <p className="mt-1 font-mono text-dash-accent">
                          {formatPrice(table.sessionTotal, currency)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
                      Available
                    </p>
                  )}
                </FloorTile>
              );
            })}
          </div>
        </section>
      ))}
        </>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.button
              type="button"
              aria-label="Close panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setSelected(null)}
            />
            <motion.aside
              initial={{ y: "100%", x: 0 }}
              animate={{ y: 0, x: 0 }}
              exit={{ y: "100%", x: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl border-t border-dash-border bg-dash-surface p-4 text-dash-text sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(100%,400px)] sm:rounded-none sm:border-l sm:border-t-0 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-bold uppercase tracking-wide">
                  {selected.name}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-raised hover:text-dash-text"
                >
                  <X className="size-5" />
                </button>
              </div>

              <p className="mt-3 text-sm text-dash-text-muted">
                Zone: {selected.zone?.name ?? "—"} · {selected.seats} seats ·
                Status:{" "}
                {selected.hasPaymentRequest
                  ? "Payment requested"
                  : tableTileStatus(selected) === "attention"
                    ? "Needs attention"
                    : selected.session || selected.activeOrders.length > 0
                      ? "Occupied"
                      : "Available"}
              </p>

              {selected.hasPaymentRequest && (
                <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300">
                  Guest requested payment — check bill / terminal
                </p>
              )}

              {selected.session && (
                <p className="mt-2 text-sm text-dash-text-disabled">
                  Session started:{" "}
                  {new Date(selected.session.opened_at).toLocaleTimeString(
                    "de-DE",
                    { hour: "2-digit", minute: "2-digit" }
                  )}{" "}
                  · Duration: {formatDuration(selected.session.opened_at)}
                </p>
              )}

              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
                  Active Orders
                </p>
                {selected.activeOrders.length === 0 ? (
                  <p className="text-sm text-dash-text-disabled">No active orders</p>
                ) : (
                  <ul className="space-y-2">
                    {selected.activeOrders.map((order) => (
                      <li
                        key={order.id}
                        className="flex items-center justify-between text-sm text-dash-text-secondary"
                      >
                        <span className="font-mono font-semibold">
                          {formatOrderNumber(order.order_number)}
                        </span>
                        <span className="text-dash-text-disabled">
                          {formatPrice(Number(order.total), currency)}
                        </span>
                        <span className="text-dash-text-muted">
                          {orderStatusLabel(order.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {selected.sessionTotal > 0 && (
                  <p className="mt-4 font-mono text-lg font-semibold text-dash-accent">
                    Session Total:{" "}
                    {formatPrice(selected.sessionTotal, currency)}
                  </p>
                )}
              </div>

              <div className="mt-8 border-t border-dash-border pt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
                  QR Code
                </p>
                {guestUrlUnsafe && (
                  <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    QR links must use your production domain. Set{" "}
                    <code className="font-mono">NEXT_PUBLIC_APP_URL</code> on
                    Vercel, redeploy, then download QR codes again.
                  </p>
                )}
                {!resolvedOrgSlug && (
                  <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Organization slug is missing — guest links need a slug like{" "}
                    <span className="font-mono">skyline-lounge</span>. Update it
                    in Settings or contact support.
                  </p>
                )}
                <div className="flex flex-col items-center gap-3">
                  {qrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrUrl}
                      alt="Table QR code"
                      className="size-[200px] rounded-lg"
                    />
                  ) : (
                    <Skeleton className="size-[200px] rounded-lg bg-dash-surface-raised" />
                  )}
                  <p className="break-all text-center text-xs text-dash-text-disabled">
                    {guestTableUrl(
                      resolvedOrgSlug,
                      selected.qr_token,
                      appUrl
                    ).replace(/^https?:\/\//, "")}
                  </p>
                  <div className="flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!qrUrl) return;
                        const a = document.createElement("a");
                        a.href = qrUrl;
                        a.download = `qr-${selected.name.replace(/\s+/g, "-")}.png`;
                        a.click();
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-dash-surface-raised px-3 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-overlay"
                    >
                      <Download className="size-4" />
                      Download QR
                    </button>
                    <button
                      type="button"
                      onClick={() => regenerateToken(selected.id)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-dash-surface-raised px-3 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-overlay"
                    >
                      <RefreshCw className="size-4" />
                      Regenerate Token
                    </button>
                  </div>
                </div>
              </div>

              {selected.session && (
                <button
                  type="button"
                  onClick={() => setBillOpen(true)}
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-dash-accent py-3 text-sm font-semibold text-white transition hover:bg-dash-accent-hover"
                >
                  <Receipt className="size-4" />
                  {wt("action.bill", menuLocale)}
                </button>
              )}

              {selected.activeOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTransferOpen(true)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-dash-surface-raised py-3 text-sm font-semibold text-dash-text transition hover:bg-dash-surface-overlay"
                >
                  <ArrowRightLeft className="size-4" />
                  Transfer
                </button>
              )}

              {selected.session && (
                <button
                  type="button"
                  onClick={() => closeSession(selected.session!.id)}
                  className="mt-3 w-full rounded-lg bg-red-600/90 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
                >
                  Close Table Session
                </button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {selected && (
        <TableBillPanel
          open={billOpen}
          onOpenChange={setBillOpen}
          tableName={selected.name}
          sessionId={selected.session?.id ?? null}
          onSettled={() => {
            setBillOpen(false);
            setSelected(null);
            load();
          }}
        />
      )}

      {selected && (
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          fromTable={selected}
          activeOrders={selected.activeOrders}
          allTables={tables}
          currency={currency}
          onSuccess={() => {
            setSelected(null);
            load();
          }}
        />
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-dash-text">Add Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="block space-y-1.5">
              <span className="text-sm text-dash-text-muted">Name</span>
              <input
                value={newTable.name}
                onChange={(e) =>
                  setNewTable((t) => ({ ...t, name: e.target.value }))
                }
                placeholder="Table 9"
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-dash-text-muted">Zone</span>
              {zones.length === 0 ? (
                <p className="rounded-lg border border-dashed border-dash-surface-overlay px-3 py-2 text-sm text-dash-text-disabled">
                  No zones —{" "}
                  <button
                    type="button"
                    className="text-dash-accent underline"
                    onClick={() => {
                      setAddOpen(false);
                      setZonesOpen(true);
                    }}
                  >
                    add a zone first
                  </button>
                </p>
              ) : (
                <select
                  value={newTable.zoneId}
                  onChange={(e) =>
                    setNewTable((t) => ({ ...t, zoneId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-dash-text-muted">Seats</span>
              <input
                type="number"
                min={1}
                max={20}
                value={newTable.seats}
                onChange={(e) =>
                  setNewTable((t) => ({
                    ...t,
                    seats: Number(e.target.value) || 1,
                  }))
                }
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              />
            </label>
          </div>
          <DialogFooter className="border-dash-border bg-transparent">
            <button
              type="button"
              disabled={saving}
              onClick={() => setAddOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-dash-text-muted hover:text-dash-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || zones.length === 0}
              onClick={addTable}
              className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Table"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={zonesOpen} onOpenChange={setZonesOpen}>
        <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-dash-text">Zones</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-dash-text-disabled">
            Name each area of your venue — e.g. Terrace, Bar, Main Hall, Zone 1.
          </p>

          <div className="flex gap-2 py-3">
            <input
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              placeholder="Terrace"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addZone();
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
            />
            <button
              type="button"
              disabled={saving || !newZoneName.trim()}
              onClick={addZone}
              className="shrink-0 rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {zones.length > 0 ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-dash-border p-2">
              {zones.map((zone) => {
                const count = tables.filter((t) => t.zone_id === zone.id).length;
                return (
                  <li
                    key={zone.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-dash-bg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-dash-text">
                        {zone.name}
                      </p>
                      <p className="text-xs text-dash-text-disabled">
                        {count} {count === 1 ? "table" : "tables"}
                      </p>
                    </div>
                    {count === 0 && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeZone(zone.id)}
                        className="shrink-0 text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-dash-text-disabled">
              No zones yet — add one above.
            </p>
          )}

          <DialogFooter className="border-dash-border bg-transparent">
            <button
              type="button"
              onClick={() => {
                setZonesOpen(false);
                if (zones.length > 0) openAddTable();
              }}
              className="rounded-lg bg-dash-surface-raised px-4 py-2 text-sm text-dash-text-secondary hover:bg-dash-surface-overlay"
            >
              {zones.length > 0 ? "Add table to zone" : "Close"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
