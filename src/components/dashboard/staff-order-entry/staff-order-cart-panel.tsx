"use client";

import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/format";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  atBarPaymentLabel,
  type PaymentMethodOption,
  type StaffCartItem,
  type TableWithZone,
} from "@/components/dashboard/staff-order-entry/types";

export function StaffOrderCartPanel({
  currency,
  cart,
  cartCount,
  selectedTable,
  onTableChange,
  tablesByZone,
  isTakeaway,
  onTakeawayChange,
  paymentMethod,
  onPaymentMethodChange,
  availablePaymentMethods,
  inPersonPaymentLocation,
  orderNotes,
  onOrderNotesChange,
  orderTotal,
  canSubmit,
  submitting,
  acceptingOrders,
  onSubmit,
  onUpdateQuantity,
  onRemoveItem,
}: {
  currency: string;
  cart: StaffCartItem[];
  cartCount: number;
  selectedTable: string;
  onTableChange: (tableId: string) => void;
  tablesByZone: Map<
    string,
    { zoneName: string; tables: TableWithZone[] }
  >;
  isTakeaway: boolean;
  onTakeawayChange: (value: boolean) => void;
  paymentMethod: PaymentMethodOption;
  onPaymentMethodChange: (value: PaymentMethodOption) => void;
  availablePaymentMethods: PaymentMethodOption[];
  inPersonPaymentLocation: InPersonPaymentLocation;
  orderNotes: string;
  onOrderNotesChange: (value: string) => void;
  orderTotal: number;
  canSubmit: boolean;
  submitting: boolean;
  acceptingOrders: boolean;
  onSubmit: () => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
}) {
  const paymentLabels: Record<PaymentMethodOption, string> = {
    at_bar: atBarPaymentLabel(inPersonPaymentLocation),
    card_at_table: "Card at table",
    card_terminal: "Kartenzahlung (Terminal)",
    online: "Pay online",
  };

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface p-4">
      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-dash-text-disabled">
          Table
        </label>
        <Select value={selectedTable} onValueChange={onTableChange}>
          <SelectTrigger className="h-11 w-full border-dash-surface-overlay bg-dash-bg text-dash-text">
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent className="border-dash-surface-overlay bg-dash-surface text-dash-text">
            {[...tablesByZone.entries()].map(([zoneKey, group]) => (
              <SelectGroup key={zoneKey}>
                <SelectLabel className="text-dash-text-disabled">
                  {group.zoneName}
                </SelectLabel>
                {group.tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dash-text">Order summary</h2>
        <span className="text-xs text-dash-text-disabled">{cartCount} items</span>
      </div>

      {cart.length === 0 ? (
        <p className="py-8 text-center text-sm text-dash-text-disabled">
          Tap products to add them to the order.
        </p>
      ) : (
        <ul className="max-h-[45vh] space-y-3 overflow-y-auto">
          {cart.map((item) => (
            <li
              key={item.id}
              className="rounded-xl bg-dash-surface p-3 ring-1 ring-dash-border"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-dash-text">
                    {item.productName}
                  </p>
                  {item.modifiers.length > 0 && (
                    <p className="mt-0.5 text-xs text-dash-text-disabled">
                      {item.modifiers
                        .map((mod) => mod.modifierName)
                        .join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-xs italic text-dash-text-disabled">
                      {item.notes}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-right text-sm font-semibold text-dash-text-secondary">
                  {formatPrice(item.lineTotal, currency)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    className="flex size-7 items-center justify-center rounded-lg border border-dash-surface-overlay text-dash-text-secondary hover:bg-dash-surface-raised"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-[1.25rem] text-center text-sm font-semibold text-dash-text">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    className="flex size-7 items-center justify-center rounded-lg border border-dash-surface-overlay text-dash-text-secondary hover:bg-dash-surface-raised"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="flex size-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-4 border-t border-dash-border pt-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-dash-text-secondary">
          <Checkbox
            checked={isTakeaway}
            onCheckedChange={(checked) => onTakeawayChange(checked === true)}
          />
          Takeaway
        </label>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-dash-text-disabled">
            Payment
          </label>
          <Select
            value={paymentMethod}
            onValueChange={(value) =>
              onPaymentMethodChange(value as PaymentMethodOption)
            }
          >
            <SelectTrigger className="w-full border-dash-surface-overlay bg-dash-bg text-dash-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-dash-surface-overlay bg-dash-surface text-dash-text">
              {availablePaymentMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {paymentLabels[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            htmlFor="staff-order-notes"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-dash-text-disabled"
          >
            Order notes
          </label>
          <Textarea
            id="staff-order-notes"
            value={orderNotes}
            onChange={(event) => onOrderNotesChange(event.target.value)}
            placeholder="Optional notes for kitchen or service…"
            rows={2}
            className="resize-none border-dash-surface-overlay bg-dash-bg text-dash-text"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-dash-text-secondary">Total</span>
          <span className="text-lg font-bold text-dash-text">
            {formatPrice(orderTotal, currency)}
          </span>
        </div>

        <Button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="h-12 w-full bg-dash-accent-hover text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Placing order…
            </>
          ) : (
            `Place Order — ${formatPrice(orderTotal, currency)}`
          )}
        </Button>

        {!acceptingOrders && (
          <p className="text-center text-xs text-amber-400">
            Orders are paused for this location.
          </p>
        )}
      </div>
    </div>
  );
}
