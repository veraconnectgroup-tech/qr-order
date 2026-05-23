"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TransferOrder = {
  id: string;
  order_number: number;
  total: number;
  status: string;
};

type TransferTable = {
  id: string;
  name: string;
  zone: { id: string; name: string } | null;
  session: { id: string; opened_at: string } | null;
  activeOrders: TransferOrder[];
};

function orderStatusLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "preparing":
    case "accepted":
      return "Preparing";
    case "ready":
      return "Ready";
    case "rejected":
      return "Rejected";
    default:
      return "New";
  }
}

function tableOccupied(table: TransferTable) {
  return Boolean(table.session) || table.activeOrders.length > 0;
}

export function TransferDialog({
  open,
  onOpenChange,
  fromTable,
  activeOrders,
  allTables,
  currency,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromTable: TransferTable;
  activeOrders: TransferOrder[];
  allTables: TransferTable[];
  currency: string;
  onSuccess: () => void;
}) {
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [targetTableId, setTargetTableId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedOrderIds(activeOrders.map((order) => order.id));
    setTargetTableId(null);
    setNote("");
    setSubmitting(false);
  }, [open, activeOrders]);

  const destinationTables = useMemo(
    () => allTables.filter((table) => table.id !== fromTable.id),
    [allTables, fromTable.id]
  );

  const groupedTables = useMemo(() => {
    const groups = new Map<string, { zoneName: string; tables: TransferTable[] }>();

    for (const table of destinationTables) {
      const zoneKey = table.zone?.id ?? "none";
      const zoneName = table.zone?.name ?? "No zone";
      const group = groups.get(zoneKey) ?? { zoneName, tables: [] };
      group.tables.push(table);
      groups.set(zoneKey, group);
    }

    return [...groups.values()].sort((a, b) =>
      a.zoneName.localeCompare(b.zoneName)
    );
  }, [destinationTables]);

  const targetTable = destinationTables.find((table) => table.id === targetTableId);
  const allSelected =
    activeOrders.length > 0 &&
    selectedOrderIds.length === activeOrders.length;

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }

  function toggleSelectAll() {
    setSelectedOrderIds(
      allSelected ? [] : activeOrders.map((order) => order.id)
    );
  }

  async function handleConfirm() {
    if (!targetTableId || selectedOrderIds.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/table-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_table_id: fromTable.id,
          to_table_id: targetTableId,
          order_ids: selectedOrderIds,
          note: note.trim() || undefined,
        }),
      });

      const parsed = await readJsonResponse<{
        ok?: boolean;
        transferred?: number;
        to_table_name?: string;
        error?: string;
      }>(res);

      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      if (!res.ok || !parsed.data.ok) {
        throw new Error(parsed.data.error ?? "Transfer failed.");
      }

      toast.success(
        `${parsed.data.transferred ?? selectedOrderIds.length} order(s) moved to ${parsed.data.to_table_name ?? targetTable?.name ?? "table"}`
      );
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Transfer failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-900 text-zinc-50 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            Transfer from {fromTable.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Select orders
              </p>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-medium text-orange-400 hover:text-orange-300"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <ul className="space-y-2">
              {activeOrders.map((order) => {
                const checked = selectedOrderIds.includes(order.id);
                return (
                  <li key={order.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition",
                        checked
                          ? "border-orange-500/50 bg-orange-500/10"
                          : "border-zinc-800 bg-zinc-950"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOrder(order.id)}
                      />
                      <span className="font-mono text-sm font-semibold text-zinc-100">
                        {formatOrderNumber(order.order_number)}
                      </span>
                      <span className="ml-auto text-sm text-zinc-400">
                        {formatPrice(Number(order.total), currency)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {orderStatusLabel(order.status)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Destination table
            </p>
            <div className="space-y-4">
              {groupedTables.map((group) => (
                <div key={group.zoneName}>
                  <p className="mb-2 text-xs font-medium text-zinc-500">
                    {group.zoneName}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.tables.map((table) => {
                      const occupied = tableOccupied(table);
                      const selected = targetTableId === table.id;
                      return (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => setTargetTableId(table.id)}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-left transition",
                            selected
                              ? "border-orange-500 bg-orange-500/15"
                              : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                          )}
                        >
                          <p className="text-sm font-semibold text-zinc-100">
                            {table.name}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {occupied ? "Occupied" : "Free"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Note (optional)
            </span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Reason for transfer…"
              maxLength={500}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
            />
          </label>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col sm:items-stretch">
          <p className="text-center text-sm text-zinc-400">
            {selectedOrderIds.length > 0 && targetTable
              ? `Transfer ${selectedOrderIds.length} order${selectedOrderIds.length === 1 ? "" : "s"} → ${targetTable.name}`
              : "Select orders and a destination table"}
          </p>
          <Button
            type="button"
            disabled={
              submitting ||
              selectedOrderIds.length === 0 ||
              !targetTableId
            }
            onClick={handleConfirm}
            className="h-11 w-full bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Transferring…
              </>
            ) : (
              "Confirm Transfer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
