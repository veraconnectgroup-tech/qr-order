"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";

export function RefundOrderDialog({
  open,
  orderNumber,
  orderTotal,
  currency,
  onClose,
  onConfirm,
}: {
  open: boolean;
  orderNumber: number;
  orderTotal: number;
  currency: string;
  onClose: () => void;
  onConfirm: (reason: string, amount?: number) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;

    const parsedAmount = amountInput.trim()
      ? Number.parseFloat(amountInput.replace(",", "."))
      : undefined;

    if (
      parsedAmount != null &&
      (Number.isNaN(parsedAmount) ||
        parsedAmount <= 0 ||
        parsedAmount > orderTotal + 0.01)
    ) {
      return;
    }

    setSaving(true);
    try {
      await onConfirm(trimmedReason, parsedAmount);
      setReason("");
      setAmountInput("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-dash-text">
            Refund order #{String(orderNumber).padStart(3, "0")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-dash-text-muted">
            Full order total:{" "}
            <span className="font-mono text-dash-text-secondary">
              {formatPrice(orderTotal, currency)}
            </span>
            . Leave amount empty for a full refund.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
              Reason (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Guest request, wrong item, etc."
              className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
              Amount (optional)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={formatPrice(orderTotal, currency)}
              className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
            />
          </div>
        </div>
        <DialogFooter className="border-dash-border bg-transparent">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-dash-text-muted hover:text-dash-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !reason.trim()}
            onClick={handleConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Processing…" : "Issue refund"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
