"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { TransferDialog } from "@/components/dashboard/transfer-dialog";
import { TableBillPanel } from "@/components/dashboard/table-bill-panel";
import { TableSessionHistory } from "@/components/dashboard/table-session-history";
import { TablesBoardDetailPanel } from "@/components/dashboard/tables-board/tables-board-detail-panel";
import { TablesBoardSessionTimer } from "@/components/dashboard/tables-board/tables-board-session-timer";
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
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TablesBoardState } from "@/hooks/use-tables-board";

export function TablesBoardShell({ state }: { state: TablesBoardState }) {
  const {
    currency,
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
    guestUrlUnsafe,
    resolvedOrgSlug,
    appUrl,
  } = state;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-8 w-24 rounded-lg bg-dash-surface-raised"
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-28 rounded-xl bg-dash-surface-raised"
            />
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
                Add areas like Terrace, Bar, or Zone 1–5, then assign tables to
                each zone.
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
                      className={
                        status === "occupied" ? "animate-pulse" : undefined
                      }
                    >
                      {table.session && (
                        <TablesBoardSessionTimer
                          openedAt={table.session.opened_at}
                        />
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
            <TablesBoardDetailPanel
              selected={selected}
              onClose={() => setSelected(null)}
              qrUrl={qrUrl}
              currency={currency}
              guestUrlUnsafe={guestUrlUnsafe}
              resolvedOrgSlug={resolvedOrgSlug}
              appUrl={appUrl}
              onRegenerateToken={regenerateToken}
              onCloseSession={closeSession}
              onOpenBill={() => setBillOpen(true)}
              onOpenTransfer={() => setTransferOpen(true)}
            />
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
