"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REASONS = [
  "Out of stock",
  "Kitchen closed",
  "Unable to fulfill",
  "Guest request",
];

export function RejectOrderDialog({
  open,
  orderNumber,
  onClose,
  onConfirm,
}: {
  open: boolean;
  orderNumber: number;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    const text = custom.trim() || reason;
    if (!text) return;
    setSaving(true);
    await onConfirm(text);
    setSaving(false);
    setCustom("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-dash-text">
            Reject order #{String(orderNumber).padStart(3, "0")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-dash-text-muted">
            Paid orders will be refunded automatically when Stripe is connected.
          </p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setReason(r);
                  setCustom("");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  reason === r && !custom
                    ? "bg-dash-accent text-white"
                    : "bg-dash-surface-raised text-dash-text-secondary hover:bg-dash-surface-overlay"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Custom reason (optional)"
            className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
          />
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
            disabled={saving}
            onClick={handleConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Rejecting…" : "Reject order"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
