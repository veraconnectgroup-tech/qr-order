"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createPromoCode,
  deletePromoCode,
  togglePromoCode,
  updatePromoCode,
} from "@/lib/admin/promo-actions";
import { formatPrice } from "@/lib/format";
import { getPromoStatus } from "@/lib/promo/validate-promo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PromoCode } from "@/types";

const STATUS_LABEL: Record<
  ReturnType<typeof getPromoStatus>,
  { label: string; className: string }
> = {
  active: { label: "Aktivan", className: "text-green-600" },
  inactive: { label: "Neaktivan", className: "text-neutral-400" },
  expired: { label: "Istekao", className: "text-amber-600" },
  exhausted: { label: "Potrošen", className: "text-red-600" },
  scheduled: { label: "Zakazan", className: "text-blue-600" },
};

function PromoForm({
  promo,
  currency,
  onSubmit,
  pending,
  error,
}: {
  promo?: PromoCode;
  currency: string;
  onSubmit: (formData: FormData) => Promise<void>;
  pending: boolean;
  error: string | null;
}) {
  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="code">Kod</Label>
        <Input
          id="code"
          name="code"
          required
          defaultValue={promo?.code ?? ""}
          className="mt-1 uppercase"
          placeholder="SUMMER20"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="discount_type">Tip</Label>
          <select
            id="discount_type"
            name="discount_type"
            defaultValue={promo?.discount_type ?? "percent"}
            className="mt-1 flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            <option value="percent">Procenat (%)</option>
            <option value="fixed">Fiksni ({currency})</option>
          </select>
        </div>
        <div>
          <Label htmlFor="discount_value">Vrednost</Label>
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={promo?.discount_value ?? ""}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="min_order_amount">Min. narudžba ({currency})</Label>
          <Input
            id="min_order_amount"
            name="min_order_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={promo?.min_order_amount ?? 0}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="max_uses">Max korišćenja (prazno = ∞)</Label>
          <Input
            id="max_uses"
            name="max_uses"
            type="number"
            min="1"
            defaultValue={promo?.max_uses ?? ""}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="valid_from">Važi od</Label>
          <Input
            id="valid_from"
            name="valid_from"
            type="datetime-local"
            defaultValue={
              promo?.valid_from
                ? new Date(promo.valid_from).toISOString().slice(0, 16)
                : ""
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="valid_until">Važi do (opciono)</Label>
          <Input
            id="valid_until"
            name="valid_until"
            type="datetime-local"
            defaultValue={
              promo?.valid_until
                ? new Date(promo.valid_until).toISOString().slice(0, 16)
                : ""
            }
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="is_active"
          name="is_active"
          type="checkbox"
          defaultChecked={promo?.is_active ?? true}
          className="size-4 rounded border-neutral-300"
        />
        <Label htmlFor="is_active">Aktivan</Label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Čuvanje..." : "Sačuvaj"}
      </Button>
    </form>
  );
}

export function PromoManager({
  promos,
  currency,
}: {
  promos: PromoCode[];
  currency: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<PromoCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCreate(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createPromoCode(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setCreateOpen(false);
  }

  async function handleUpdate(formData: FormData) {
    if (!editPromo) return;
    setPending(true);
    setError(null);
    const result = await updatePromoCode(editPromo.id, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditPromo(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Obrisati promo kod?")) return;
    await deletePromoCode(id);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Promo kodovi</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Popusti za goste pri checkout-u
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Novi kod
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novi promo kod</DialogTitle>
            </DialogHeader>
            <PromoForm
              currency={currency}
              onSubmit={handleCreate}
              pending={pending}
              error={error}
            />
          </DialogContent>
        </Dialog>
      </div>

      {!promos.length ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-neutral-600">Još nema promo kodova.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Kod</th>
                <th className="px-4 py-3 font-medium">Popust</th>
                <th className="px-4 py-3 font-medium">Min.</th>
                <th className="px-4 py-3 font-medium">Korišćenja</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => {
                const status = getPromoStatus(promo);
                const statusMeta = STATUS_LABEL[status];
                return (
                  <tr key={promo.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {promo.code}
                    </td>
                    <td className="px-4 py-3">
                      {promo.discount_type === "percent"
                        ? `${promo.discount_value}%`
                        : formatPrice(Number(promo.discount_value), currency)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {Number(promo.min_order_amount) > 0
                        ? formatPrice(Number(promo.min_order_amount), currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {promo.used_count}
                      {promo.max_uses != null ? ` / ${promo.max_uses}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusMeta.className}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setError(null);
                            setEditPromo(promo);
                          }}
                          aria-label="Izmeni"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            togglePromoCode(promo.id, !promo.is_active)
                          }
                        >
                          {promo.is_active ? "Deaktiviraj" : "Aktiviraj"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(promo.id)}
                          aria-label="Obriši"
                        >
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editPromo} onOpenChange={(open) => !open && setEditPromo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Izmeni promo kod</DialogTitle>
          </DialogHeader>
          {editPromo && (
            <PromoForm
              promo={editPromo}
              currency={currency}
              onSubmit={handleUpdate}
              pending={pending}
              error={error}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
