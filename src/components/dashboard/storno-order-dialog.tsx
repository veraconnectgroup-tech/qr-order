"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRESET_REASONS = [
  "Wrong item entered",
  "Duplicate order",
  "Guest cancelled",
  "Kitchen mistake",
];

export function StornoOrderDialog({
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
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 3;

  async function handleConfirm() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-dash-text">
            Storno order #{String(orderNumber).padStart(3, "0")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-dash-text-muted">
            Paid electronic orders are refunded when possible. TSE storno is
            scheduled when a fiscal signature exists.
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  reason === preset
                    ? "bg-red-600 text-white"
                    : "bg-dash-surface-raised text-dash-text-secondary hover:bg-dash-surface-overlay"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for storno (required)"
            rows={3}
            className="w-full resize-none rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-red-500"
          />
        </div>
        <DialogFooter className="border-dash-border bg-transparent">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-dash-text-muted hover:text-dash-text-secondary"
          >
            Back
          </button>
          <button
            type="button"
            disabled={saving || !canSubmit}
            onClick={() => void handleConfirm()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Cancelling…" : "Confirm storno"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
