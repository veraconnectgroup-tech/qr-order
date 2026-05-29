"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { StaffOrderQueueItem } from "@/lib/offline/order-queue";

type StaffOrderConflictSheetProps = {
  item: StaffOrderQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveUnavailable: (item: StaffOrderQueueItem) => void;
  onCancel: (item: StaffOrderQueueItem) => void;
  onRetry: (item: StaffOrderQueueItem) => void;
  busy?: boolean;
};

export function StaffOrderConflictSheet({
  item,
  open,
  onOpenChange,
  onRemoveUnavailable,
  onCancel,
  onRetry,
  busy = false,
}: StaffOrderConflictSheetProps) {
  const unavailable = item?.unavailableProducts ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-dash-border bg-dash-bg text-dash-text"
      >
        <SheetHeader>
          <SheetTitle>Produkte nicht verfügbar</SheetTitle>
          <SheetDescription className="text-dash-text-secondary">
            {item
              ? `Bestellung für ${item.tableName} — folgende Artikel sind nicht mehr verfügbar:`
              : "Sync-Konflikt"}
          </SheetDescription>
        </SheetHeader>

        {unavailable.length > 0 && (
          <ul className="my-4 space-y-2">
            {unavailable.map((name) => (
              <li
                key={name}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
              >
                {name}
              </li>
            ))}
          </ul>
        )}

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            disabled={!item || busy || unavailable.length === 0}
            onClick={() => item && onRemoveUnavailable(item)}
            className="h-11 w-full bg-dash-accent text-white hover:bg-dash-accent-hover"
          >
            Nicht verfügbare entfernen & erneut senden
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!item || busy}
            onClick={() => item && onRetry(item)}
            className="h-11 w-full border-dash-border bg-dash-surface text-dash-text"
          >
            Erneut versuchen
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!item || busy}
            onClick={() => item && onCancel(item)}
            className="h-11 w-full text-dash-text-secondary hover:text-dash-text"
          >
            Bestellung verwerfen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
