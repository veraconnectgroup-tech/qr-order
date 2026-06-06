"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import {
  discardQueuedStaffOrder,
  retryQueuedStaffOrder,
  subscribeSyncState,
  syncQueuedStaffOrders,
  type SyncState,
} from "@/lib/offline/sync-manager";
import { Button } from "@/components/ui/button";

export function ConnectionBanner() {
  const { status, recheck } = useConnectionStatus();
  const [syncState, setSyncState] = useState<SyncState>({
    syncing: false,
    pendingCount: 0,
    failed: [],
    conflicted: [],
    lastSyncAt: null,
  });
  const [showRestored, setShowRestored] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);

  useEffect(() => subscribeSyncState(setSyncState), []);

  useEffect(() => {
    if (
      (prevStatus === "offline" || prevStatus === "degraded") &&
      status === "online"
    ) {
      setShowRestored(true);
      void syncQueuedStaffOrders();
      const id = setTimeout(() => setShowRestored(false), 3000);
      setPrevStatus(status);
      return () => clearTimeout(id);
    }
    setPrevStatus(status);
  }, [status, prevStatus]);

  const showBanner =
    status !== "online" ||
    syncState.pendingCount > 0 ||
    syncState.failed.length > 0 ||
    syncState.conflicted.length > 0 ||
    showRestored;

  if (!showBanner) return null;

  if (showRestored && status === "online" && syncState.pendingCount === 0) {
    return (
      <div
        role="status"
        className="sticky top-0 z-50 border-b border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-center text-sm font-medium text-emerald-800 dark:text-emerald-200"
      >
        Verbindung wiederhergestellt ✓
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        "sticky top-0 z-50 border-b px-4 py-2 text-sm",
        status === "offline" &&
          "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200",
        status === "degraded" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
        status === "online" &&
          syncState.pendingCount === 0 &&
          syncState.failed.length === 0 &&
          "hidden"
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 text-center">
        {status === "offline" ? (
          <>
            <WifiOff className="size-4 shrink-0" />
            <span className="font-medium">
              Keine Verbindung — Offline-Modus aktiv
            </span>
          </>
        ) : status === "degraded" ? (
          <>
            <Wifi className="size-4 shrink-0" />
            <span className="font-medium">
              Verbindung instabil — Bestellungen werden zwischengespeichert
            </span>
          </>
        ) : null}

        {syncState.syncing && syncState.pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <RefreshCw className="size-3.5 animate-spin" />
            {syncState.pendingCount} Bestellung
            {syncState.pendingCount === 1 ? "" : "en"} werden synchronisiert…
          </span>
        )}

        {!syncState.syncing && syncState.pendingCount > 0 && status !== "offline" && (
          <span className="text-muted-foreground">
            {syncState.pendingCount} Bestellung
            {syncState.pendingCount === 1 ? "" : "en"} warten auf Sync
            {syncState.conflicted.length > 0 ?
              ` (${syncState.conflicted.length} Konflikt${syncState.conflicted.length === 1 ? "" : "e"})`
            : ""}
          </span>
        )}

        {status !== "offline" && status === "degraded" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => void recheck()}
          >
            Erneut prüfen
          </Button>
        )}
      </div>

      {syncState.failed.length > 0 && (
        <div className="mx-auto mt-2 max-w-4xl space-y-1 border-t border-black/5 pt-2 dark:border-white/10">
          {syncState.failed.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-center gap-2 text-xs"
            >
              <span>
                {item.tableName}: {item.lastError ?? "Sync fehlgeschlagen"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void retryQueuedStaffOrder(item.id)}
              >
                Erneut senden
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => void discardQueuedStaffOrder(item.id)}
              >
                Entfernen
              </Button>
              <span className="w-full text-[10px] text-muted-foreground">
                Bereits im Dashboard? Entfernen löscht nur die lokale Warteschlange.
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
