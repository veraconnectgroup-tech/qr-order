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
      <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            Reject order #{String(orderNumber).padStart(3, "0")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-zinc-400">
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
                    ? "bg-orange-500 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
          />
        </div>
        <DialogFooter className="border-zinc-800 bg-transparent">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
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
