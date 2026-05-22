"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Order, Table, TableSession, Zone } from "@/types";

type TableOrder = Pick<Order, "id" | "order_number" | "total" | "status">;

type TableRow = Table & {
  zone: Zone | null;
  session: Pick<TableSession, "id" | "opened_at"> | null;
  activeOrders: TableOrder[];
  sessionTotal: number;
  hasWaiterCall: boolean;
};

type ZoneTab = {
  id: string;
  name: string;
  count: number;
};

function formatDuration(since: string) {
  const ms = Date.now() - new Date(since).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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

function displayHostUrl(appUrl: string, orgSlug: string, token: string) {
  try {
    const host = new URL(appUrl).host;
    return `${host}/${orgSlug}/${token}`;
  } catch {
    return `${appUrl}/${orgSlug}/${token}`;
  }
}

export function TablesBoard() {
  const { locationId, orgSlug, orgName, currency } = useDashboard();
  const waiterCallsResult = useRealtimeWaiterCalls(locationId);
  const waiterCalls = waiterCallsResult.calls;
  const [tables, setTables] = useState<TableRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZone, setActiveZone] = useState<string>("all");
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTable, setNewTable] = useState({ name: "", zoneId: "", seats: 4 });

  const pendingCallTableIds = useMemo(
    () =>
      new Set(
        waiterCalls.filter((c) => c.status === "pending").map((c) => c.table_id)
      ),
    [waiterCalls]
  );

  const load = useCallback(async () => {
    const supabase = createClient();

    const { data: zonesData } = await supabase
      .from("zones")
      .select("*")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .order("sort_order");

    const { data: tablesData } = await supabase
      .from("tables")
      .select("*, zone:zones(*)")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .order("name");

    const { data: sessions } = await supabase
      .from("table_sessions")
      .select("id, table_id, opened_at")
      .eq("location_id", locationId)
      .eq("status", "active");

    const sessionMap = new Map(
      (sessions ?? []).map((s) => [
        (s as { table_id: string }).table_id,
        s as Pick<TableSession, "id" | "opened_at">,
      ])
    );

    const { data: orders } = await supabase
      .from("orders")
      .select("id, table_id, session_id, order_number, total, status, created_at")
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso())
      .neq("status", "rejected");

    const ordersByTable = new Map<string, TableOrder[]>();
    for (const o of orders ?? []) {
      const row = o as TableOrder & {
        table_id: string | null;
        session_id: string | null;
      };
      if (!row.table_id) continue;

      const session = sessionMap.get(row.table_id);
      if (session) {
        if (row.session_id !== session.id) continue;
      } else if (
        !["pending", "accepted", "preparing", "ready"].includes(row.status)
      ) {
        continue;
      }

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
      return {
        ...t,
        zone: t.zone,
        session,
        activeOrders,
        sessionTotal,
        hasWaiterCall: pendingCallTableIds.has(t.id),
      };
    });

    setZones((zonesData as Zone[]) ?? []);
    setTables(enriched);
    setLoading(false);
  }, [locationId, pendingCallTableIds]);

  useEffect(() => {
    load();
  }, [load]);

  const zoneTabs = useMemo(() => {
    const map = new Map<string, ZoneTab>();
    for (const table of tables) {
      if (!table.zone) continue;
      const existing = map.get(table.zone.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(table.zone.id, {
          id: table.zone.id,
          name: table.zone.name,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [tables]);

  const filtered = useMemo(() => {
    if (activeZone === "all") return tables;
    return tables.filter((t) => t.zone_id === activeZone);
  }, [tables, activeZone]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  useEffect(() => {
    if (!selected) {
      setQrUrl(null);
      return;
    }
    const url = `${appUrl}/${orgSlug}/${selected.qr_token}`;
    QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setQrUrl);
  }, [selected, appUrl, orgSlug]);

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
    const supabase = createClient();
    const { error } = await supabase
      .from("table_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("status", "active");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Table session closed");
    setSelected(null);
    load();
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
    const qrItems = await Promise.all(
      tables.map(async (table) => {
        const url = `${appUrl}/${orgSlug}/${table.qr_token}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 160, margin: 1 });
        return { name: table.name, zone: table.zone?.name ?? "—", dataUrl, url };
      })
    );

    const html = `<!DOCTYPE html>
<html><head><title>${orgName} — QR Codes</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .card { text-align: center; page-break-inside: avoid; border: 1px solid #ddd; padding: 16px; border-radius: 12px; }
  .card img { width: 160px; height: 160px; }
  .name { font-weight: bold; font-size: 18px; margin-top: 8px; }
  .zone { color: #666; font-size: 12px; }
  @media print { .grid { grid-template-columns: repeat(3, 1fr); } }
</style></head><body>
<h1>${orgName} — Table QR Codes</h1>
<div class="grid">
${qrItems
  .map(
    (item) => `<div class="card">
  <img src="${item.dataUrl}" alt="${item.name}" />
  <div class="name">${item.name}</div>
  <div class="zone">${item.zone}</div>
</div>`
  )
  .join("\n")}
</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Allow pop-ups to download QR codes");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  function tableStatus(table: TableRow) {
    if (table.hasWaiterCall) return "attention" as const;
    if (table.session || table.activeOrders.length > 0) return "occupied" as const;
    return "available" as const;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg bg-zinc-800" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 border-b border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveZone("all")}
            className={cn(
              "pb-2 text-sm font-medium transition",
              activeZone === "all"
                ? "border-b-2 border-orange-500 text-white"
                : "text-zinc-400 hover:text-white"
            )}
          >
            All ({tables.length})
          </button>
          {zoneTabs.map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => setActiveZone(zone.id)}
              className={cn(
                "pb-2 text-sm font-medium transition",
                activeZone === zone.id
                  ? "border-b-2 border-orange-500 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {zone.name} ({zone.count})
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadAllQrCodes}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
          >
            Download All QR Codes
          </button>
          <button
            type="button"
            onClick={() => {
              setNewTable({ name: "", zoneId: zones[0]?.id ?? "", seats: 4 });
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <Plus className="size-4" />
            Add Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.map((table) => {
          const status = tableStatus(table);
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelected(table)}
              className={cn(
                "cursor-pointer rounded-xl border bg-zinc-900 p-5 text-center transition hover:border-zinc-600",
                status === "attention" && "animate-pulse border-red-500",
                status === "occupied" && "border-green-500/50",
                status === "available" && "border-zinc-800"
              )}
            >
              <p className="font-mono text-xl font-bold text-zinc-50">
                {table.name}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{table.seats} seats</p>
              {status === "attention" ? (
                <p className="mt-2 text-sm text-red-400">
                  <span className="mr-1 inline-block size-2 rounded-full bg-red-500" />
                  Needs attention
                </p>
              ) : status === "occupied" ? (
                <>
                  <p className="mt-2 text-sm text-green-400">
                    <span className="mr-1 inline-block size-2 rounded-full bg-green-500" />
                    Occupied
                  </p>
                  {table.sessionTotal > 0 && (
                    <p className="mt-1 font-mono text-orange-500">
                      {formatPrice(table.sessionTotal, currency)}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  <span className="mr-1 inline-block size-2 rounded-full bg-green-500" />
                  Available
                </p>
              )}
            </button>
          );
        })}
      </div>

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
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-6 text-zinc-50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-bold uppercase tracking-wide">
                  {selected.name}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="size-5" />
                </button>
              </div>

              <p className="mt-3 text-sm text-zinc-400">
                Zone: {selected.zone?.name ?? "—"} · {selected.seats} seats ·
                Status:{" "}
                {tableStatus(selected) === "occupied" ||
                tableStatus(selected) === "attention"
                  ? "Occupied"
                  : "Available"}
              </p>

              {selected.session && (
                <p className="mt-2 text-sm text-zinc-500">
                  Session started:{" "}
                  {new Date(selected.session.opened_at).toLocaleTimeString(
                    "de-DE",
                    { hour: "2-digit", minute: "2-digit" }
                  )}{" "}
                  · Duration: {formatDuration(selected.session.opened_at)}
                </p>
              )}

              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Active Orders
                </p>
                {selected.activeOrders.length === 0 ? (
                  <p className="text-sm text-zinc-600">No active orders</p>
                ) : (
                  <ul className="space-y-2">
                    {selected.activeOrders.map((order) => (
                      <li
                        key={order.id}
                        className="flex items-center justify-between text-sm text-zinc-300"
                      >
                        <span className="font-mono font-semibold">
                          {formatOrderNumber(order.order_number)}
                        </span>
                        <span className="text-zinc-500">
                          {formatPrice(Number(order.total), currency)}
                        </span>
                        <span className="text-zinc-400">
                          {orderStatusLabel(order.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {selected.sessionTotal > 0 && (
                  <p className="mt-4 font-mono text-lg font-semibold text-orange-500">
                    Session Total:{" "}
                    {formatPrice(selected.sessionTotal, currency)}
                  </p>
                )}
              </div>

              <div className="mt-8 border-t border-zinc-800 pt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  QR Code
                </p>
                <div className="flex flex-col items-center gap-3">
                  {qrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrUrl}
                      alt="Table QR code"
                      className="size-[200px] rounded-lg"
                    />
                  ) : (
                    <Skeleton className="size-[200px] rounded-lg bg-zinc-800" />
                  )}
                  <p className="break-all text-center text-xs text-zinc-500">
                    {displayHostUrl(appUrl, orgSlug, selected.qr_token)}
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
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
                    >
                      <Download className="size-4" />
                      Download QR
                    </button>
                    <button
                      type="button"
                      onClick={() => regenerateToken(selected.id)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
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
                  onClick={() => closeSession(selected.session!.id)}
                  className="mt-8 w-full rounded-lg bg-red-600/90 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
                >
                  Close Table Session
                </button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Add Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Name</span>
              <input
                value={newTable.name}
                onChange={(e) =>
                  setNewTable((t) => ({ ...t, name: e.target.value }))
                }
                placeholder="Table 9"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Zone</span>
              <select
                value={newTable.zoneId}
                onChange={(e) =>
                  setNewTable((t) => ({ ...t, zoneId: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Seats</span>
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
          </div>
          <DialogFooter className="border-zinc-800 bg-transparent">
            <button
              type="button"
              disabled={saving}
              onClick={() => setAddOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={addTable}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Table"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
