"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  TABLE_WITH_ZONE_SELECT,
  tableWithZoneRows,
} from "@/lib/supabase/query-rows";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useAppBaseUrl } from "@/hooks/use-app-base-url";
import { guestTableUrl, isUnsafeGuestBaseUrl } from "@/lib/app-url";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import {
  buildQrTableCardPrintHtml,
  formatBrandSubline,
  generateTableQrDataUrl,
  openQrTableCardPrintWindow,
  prepareQrTableCardItems,
  resolveQrTableCardLocale,
} from "@/lib/print/qr-table-card-print";
import {
  isActiveTableOrder,
  orderHasPaymentRequest,
} from "@/lib/dashboard/table-active-orders";
import {
  startOfTodayIso,
  type TableOrder,
  type TableRow,
} from "@/components/dashboard/tables-board/types";
import type { TableSession, Zone, Table } from "@/types";

export function useTablesBoard() {
  const {
    locationId,
    orgId,
    orgSlug: contextOrgSlug,
    orgName,
    orgLogoUrl,
    currency,
    menuLocale,
    venueTheme,
  } = useDashboard();
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
        .select(TABLE_WITH_ZONE_SELECT)
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

    const enriched: TableRow[] = tableWithZoneRows(tablesData).map((t) => {
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
    generateTableQrDataUrl(url, 200, {
      brandColor: venueTheme.primaryColor,
      logoUrl: orgLogoUrl,
    }).then(setQrUrl);
  }, [selected, appUrl, resolvedOrgSlug, venueTheme.primaryColor, orgLogoUrl]);

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
    const branding = {
      brandColor: venueTheme.primaryColor,
      logoUrl: orgLogoUrl,
    };
    const items = await prepareQrTableCardItems(
      tables.map((table) => ({
        tableName: table.name,
        zoneName: table.zone?.name,
        scanUrl: guestTableUrl(resolvedOrgSlug, table.qr_token, appUrl),
      })),
      200,
      branding
    );

    const html = buildQrTableCardPrintHtml({
      venueName: orgName,
      items,
      locale: resolveQrTableCardLocale(menuLocale),
      autoPrint: true,
      brandColor: venueTheme.primaryColor,
      brandSubline: formatBrandSubline(
        venueTheme.displayName,
        venueTheme.productSubline
      ),
    });

    const win = openQrTableCardPrintWindow(html);
    if (!win) {
      toast.error("Allow pop-ups to download QR codes");
    }
  }


  return {
    orgName,
    currency,
    menuLocale,
    appUrl,
    resolvedOrgSlug,
    guestUrlUnsafe,
    tables,
    zones,
    activeZone,
    setActiveZone,
    isHistoryView,
    selected,
    setSelected,
    qrUrl,
    loading,
    addOpen,
    setAddOpen,
    zonesOpen,
    setZonesOpen,
    saving,
    transferOpen,
    setTransferOpen,
    billOpen,
    setBillOpen,
    newTable,
    setNewTable,
    newZoneName,
    setNewZoneName,
    zoneTabs,
    groupedTables,
    load,
    regenerateToken,
    closeSession,
    addZone,
    removeZone,
    openAddTable,
    addTable,
    downloadAllQrCodes,
  };
}

export type TablesBoardState = ReturnType<typeof useTablesBoard>;
