"use client";

import { useMemo, useState, useTransition } from "react";
import { PartyPopper } from "lucide-react";
import { toast } from "sonner";
import {
  activateDenisEventMode,
  clearDenisEventConfig,
  saveDenisEventConfig,
} from "@/lib/admin/denis-event-actions";
import type { EventAdminSnapshot } from "@/lib/admin/denis-event-mode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function toLocalDatetimeValue(iso: string | undefined): string {
  if (!iso?.trim()) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDatetimeValue(value: string): string {
  if (!value.trim()) return new Date().toISOString();
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}

export function DenisEventPanel({ snapshot }: { snapshot: EventAdminSnapshot }) {
  const event = snapshot.event;
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(event?.name ?? "");
  const [expectedGuests, setExpectedGuests] = useState(
    String(event?.expectedGuests ?? 20)
  );
  const [presetMenu, setPresetMenu] = useState(event?.presetMenu ?? true);
  const [presetProductIds, setPresetProductIds] = useState<string[]>(
    event?.presetProductIds ?? []
  );
  const [startTime, setStartTime] = useState(toLocalDatetimeValue(event?.startTime));
  const [endTime, setEndTime] = useState(toLocalDatetimeValue(event?.endTime));
  const [specialInstructions, setSpecialInstructions] = useState(
    event?.specialInstructions ?? ""
  );
  const [cakeAt, setCakeAt] = useState(event?.cakeAt ?? "");

  const isActive = snapshot.operatingMode === "event";

  const selectedProducts = useMemo(
    () =>
      snapshot.products.filter((product) => presetProductIds.includes(product.id)),
    [snapshot.products, presetProductIds]
  );

  function toggleProduct(productId: string) {
    setPresetProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function save(activateMode: boolean) {
    startTransition(async () => {
      const result = await saveDenisEventConfig({
        name,
        expectedGuests: Number(expectedGuests),
        presetMenu,
        presetProductIds: presetMenu ? presetProductIds : [],
        startTime: fromLocalDatetimeValue(startTime),
        endTime: fromLocalDatetimeValue(endTime),
        specialInstructions,
        cakeAt: cakeAt.trim() || null,
        activateMode,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(activateMode ? "Event sačuvan i aktiviran." : "Event sačuvan.");
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await activateDenisEventMode(!isActive);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Event mode isključen." : "Event mode uključen.");
    });
  }

  function clearEvent() {
    startTransition(async () => {
      const result = await clearDenisEventConfig();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Event profil obrisan.");
    });
  }

  return (
    <div className="space-y-6">
      {snapshot.gatheringHint ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {snapshot.gatheringHint}
        </div>
      ) : null}

      {snapshot.copilotBlock ? (
        <div className="rounded-lg border border-border bg-card p-4 font-mono text-sm whitespace-pre-wrap">
          {snapshot.copilotBlock.lines.join("\n")}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 size-5 text-orange-500" />
            <div>
              <h2 className="text-lg font-semibold">Event profil</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Denis preskače upsell, skraćuje odgovore i drži preset meni tokom
                događaja.
              </p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide",
              isActive
                ? "bg-orange-500/15 text-orange-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isActive ? "Aktivan" : "Neaktivan"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Naziv</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Rođendan, korporativna večera…"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Očekivani gosti
            </span>
            <input
              type="number"
              min={1}
              max={500}
              value={expectedGuests}
              onChange={(e) => setExpectedGuests(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Početak</span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Kraj</span>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              Torta (HH:mm)
            </span>
            <input
              value={cakeAt}
              onChange={(e) => setCakeAt(e.target.value)}
              className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="21:00"
            />
          </label>
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              Specijalna uputstva (staff copilot)
            </span>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Torta dolazi u 21h, bez upsella na desert…"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={presetMenu}
            onChange={(e) => setPresetMenu(e.target.checked)}
          />
          Preset meni — samo izabrani proizvodi
        </label>

        {presetMenu ? (
          <div className="mt-4 max-h-56 overflow-y-auto rounded-md border border-border/70 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Proizvodi na event meniju ({selectedProducts.length})
            </p>
            <ul className="space-y-1">
              {snapshot.products.map((product) => (
                <li key={product.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={presetProductIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                    />
                    <span>{product.name}</span>
                    {product.categoryName ? (
                      <span className="text-xs text-muted-foreground">
                        · {product.categoryName}
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => save(false)}>
            Sačuvaj
          </Button>
          <Button disabled={pending} variant="secondary" onClick={() => save(true)}>
            Sačuvaj i aktiviraj
          </Button>
          <Button disabled={pending} variant="outline" onClick={toggleActive}>
            {isActive ? "Isključi event mode" : "Uključi event mode"}
          </Button>
          {event ? (
            <Button disabled={pending} variant="ghost" onClick={clearEvent}>
              Obriši profil
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
