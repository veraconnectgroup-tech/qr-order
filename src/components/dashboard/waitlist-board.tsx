"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, GripVertical, Users } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type WaitlistRow = {
  entryId: string;
  position: number;
  guestName: string;
  partySize: number;
  waitedMinutes: number;
  estimatedMinutes: number;
  status: string;
  priorityBoost: number;
  isReturningGuest: boolean;
};

type WaitlistSnapshot = {
  rows: WaitlistRow[];
  queueLength: number;
  config: {
    avgTurnoverMinutes: number;
    noShowTimeoutMinutes: number;
  };
};

function SortableWaitlistRow({
  row,
  pending,
  onNotify,
  onSeat,
  onSkip,
}: {
  row: WaitlistRow;
  pending: boolean;
  onNotify: (id: string) => void;
  onSeat: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.entryId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dash-border/60 bg-dash-surface px-3 py-3",
        isDragging && "opacity-80 shadow-lg"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <button
          type="button"
          className="mt-0.5 touch-target text-dash-muted hover:text-dash-foreground"
          aria-label="Reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="font-medium text-dash-foreground">
            {row.position}. {row.guestName}
            {row.priorityBoost > 0 ? (
              <span className="ml-2 text-xs text-orange-400">
                VIP +{row.priorityBoost}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-dash-muted">
            <Users className="mr-1 inline size-3" />
            {row.partySize} · čeka {row.waitedMinutes} min · sto ~{row.estimatedMinutes} min ·{" "}
            {row.status}
            {row.isReturningGuest ? " · returning" : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || row.status === "seated"}
          onClick={() => onNotify(row.entryId)}
        >
          Obavijesti
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || row.status === "seated"}
          onClick={() => onSeat(row.entryId)}
        >
          Sjedio
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => onSkip(row.entryId)}
        >
          Preskoči
        </Button>
      </div>
    </li>
  );
}

export function WaitlistBoard() {
  const { locationId, orgSlug } = useDashboard();
  const [snapshot, setSnapshot] = useState<WaitlistSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/commerce/waitlist?locationId=${encodeURIComponent(locationId)}`
      );
      const json = (await res.json()) as { data?: WaitlistSnapshot };
      if (json.data) setSnapshot(json.data);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const rows = snapshot?.rows ?? [];
  const rowIds = useMemo(() => rows.map((row) => row.entryId), [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  async function patchWaitlist(body: Record<string, unknown>) {
    if (!locationId) return;
    setPending(true);
    try {
      await fetch("/api/commerce/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, slug: orgSlug, ...body }),
      });
      await load();
    } finally {
      setPending(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rowIds.indexOf(String(active.id));
    const newIndex = rowIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextIds = arrayMove(rowIds, oldIndex, newIndex);
    void patchWaitlist({ action: "reorder", orderedEntryIds: nextIds });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-dash-surface-raised" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dash-foreground">Waitlist</h1>
          <p className="text-sm text-dash-muted">
            {snapshot?.queueLength ?? 0} u redu · avg turnover{" "}
            {snapshot?.config.avgTurnoverMinutes ?? 25} min · no-show{" "}
            {snapshot?.config.noShowTimeoutMinutes ?? 10} min
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Osvježi
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dash-border/60 bg-dash-surface px-4 py-10 text-center text-sm text-dash-muted">
          <Clock className="mx-auto mb-2 size-5 opacity-60" />
          Red čekanja je prazan.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {rows.map((row) => (
                <SortableWaitlistRow
                  key={row.entryId}
                  row={row}
                  pending={pending}
                  onNotify={(id) => void patchWaitlist({ entryId: id, action: "notify" })}
                  onSeat={(id) => void patchWaitlist({ entryId: id, action: "seat" })}
                  onSkip={(id) => void patchWaitlist({ entryId: id, action: "no_show" })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
