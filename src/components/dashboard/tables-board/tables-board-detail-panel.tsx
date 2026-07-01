"use client";

import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Download,
  Receipt,
  RefreshCw,
  X,
} from "lucide-react";
import {
  formatDuration,
  orderStatusLabel,
  type TableRow,
} from "@/components/dashboard/tables-board/types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { guestTableUrl } from "@/lib/app-url";
import { tableTileStatus } from "@/lib/dashboard/table-tile-status";
import { waiterUiEnglish } from "@/lib/i18n/waiter-app-ui";

export function TablesBoardDetailPanel({
  selected,
  onClose,
  qrUrl,
  currency,
  guestUrlUnsafe,
  resolvedOrgSlug,
  appUrl,
  onRegenerateToken,
  onCloseSession,
  onOpenBill,
  onOpenTransfer,
}: {
  selected: TableRow;
  onClose: () => void;
  qrUrl: string | null;
  currency: string;
  guestUrlUnsafe: boolean;
  resolvedOrgSlug: string;
  appUrl: string;
  onRegenerateToken: (tableId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onOpenBill: () => void;
  onOpenTransfer: () => void;
}) {
  return (
    <motion.aside
      initial={{ y: "100%", x: 0 }}
      animate={{ y: 0, x: 0 }}
      exit={{ y: "100%", x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl border-t border-dash-border bg-dash-surface p-4 text-dash-text sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(100%,400px)] sm:rounded-none sm:border-l sm:border-t-0 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold uppercase tracking-wide">
          {selected.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-raised hover:text-dash-text"
        >
          <X className="size-5" />
        </button>
      </div>

      <p className="mt-3 text-sm text-dash-text-muted">
        Zone: {selected.zone?.name ?? "—"} · {selected.seats} seats · Status:{" "}
        {selected.hasPaymentRequest
          ? "Payment requested"
          : tableTileStatus(selected) === "attention"
            ? "Needs attention"
            : selected.session || selected.activeOrders.length > 0
              ? "Occupied"
              : "Available"}
      </p>

      {selected.hasPaymentRequest && (
        <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300">
          Guest requested payment — check bill / terminal
        </p>
      )}

      {selected.session && (
        <p className="mt-2 text-sm text-dash-text-disabled">
          Session started:{" "}
          {new Date(selected.session.opened_at).toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · Duration: {formatDuration(selected.session.opened_at)}
        </p>
      )}

      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          Active Orders
        </p>
        {selected.activeOrders.length === 0 ? (
          <p className="text-sm text-dash-text-disabled">No active orders</p>
        ) : (
          <ul className="space-y-2">
            {selected.activeOrders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between text-sm text-dash-text-secondary"
              >
                <span className="font-mono font-semibold">
                  {formatOrderNumber(order.order_number)}
                </span>
                <span className="text-dash-text-disabled">
                  {formatPrice(Number(order.total), currency)}
                </span>
                <span className="text-dash-text-muted">
                  {orderStatusLabel(order.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {selected.sessionTotal > 0 && (
          <p className="mt-4 font-mono text-lg font-semibold text-dash-accent">
            Session Total: {formatPrice(selected.sessionTotal, currency)}
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-dash-border pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          QR Code
        </p>
        {guestUrlUnsafe && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            QR links must use your production domain. Set{" "}
            <code className="font-mono">NEXT_PUBLIC_APP_URL</code> on Vercel,
            redeploy, then download QR codes again.
          </p>
        )}
        {!resolvedOrgSlug && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Organization slug is missing — guest links need a slug like{" "}
            <span className="font-mono">skyline-lounge</span>. Update it in
            Settings or contact support.
          </p>
        )}
        <div className="flex flex-col items-center gap-3">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt="Table QR code"
              className="size-[200px] rounded-lg"
            />
          ) : (
            <Skeleton className="size-[200px] rounded-lg bg-dash-surface-raised" />
          )}
          <p className="break-all text-center text-xs text-dash-text-disabled">
            {guestTableUrl(resolvedOrgSlug, selected.qr_token, appUrl).replace(
              /^https?:\/\//,
              ""
            )}
          </p>
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => {
                if (!qrUrl) return;
                const a = document.createElement("a");
                a.href = qrUrl;
                a.download = `qr-${selected.name.replace(/\s+/g, "-")}.png`;
                a.click();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-dash-surface-raised px-3 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-overlay"
            >
              <Download className="size-4" />
              Download QR
            </button>
            <button
              type="button"
              onClick={() => onRegenerateToken(selected.id)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-dash-surface-raised px-3 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-overlay"
            >
              <RefreshCw className="size-4" />
              Regenerate Token
            </button>
          </div>
        </div>
      </div>

      {selected.session && (
        <button
          type="button"
          onClick={onOpenBill}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-dash-accent py-3 text-sm font-semibold text-white transition hover:bg-dash-accent-hover"
        >
          <Receipt className="size-4" />
          {waiterUiEnglish("action.bill")}
        </button>
      )}

      {selected.activeOrders.length > 0 && (
        <button
          type="button"
          onClick={onOpenTransfer}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-dash-surface-raised py-3 text-sm font-semibold text-dash-text transition hover:bg-dash-surface-overlay"
        >
          <ArrowRightLeft className="size-4" />
          Transfer
        </button>
      )}

      {selected.session && (
        <button
          type="button"
          onClick={() => onCloseSession(selected.session!.id)}
          className="mt-3 w-full rounded-lg bg-red-600/90 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
        >
          Close Table Session
        </button>
      )}
    </motion.aside>
  );
}
