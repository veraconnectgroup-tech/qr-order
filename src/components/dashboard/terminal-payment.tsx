"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { loadStripeTerminal } from "@stripe/terminal-js";
import type { Reader, Terminal } from "@stripe/terminal-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type TerminalPhase =
  | "initializing"
  | "discovering"
  | "connecting"
  | "ready"
  | "creating_intent"
  | "waiting_for_card"
  | "processing"
  | "success"
  | "error";

type TerminalPaymentProps = {
  open: boolean;
  orderId?: string;
  sessionId?: string;
  amount: number;
  currency: string;
  orderLabel?: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function TerminalPayment({
  open,
  orderId,
  sessionId,
  amount,
  currency,
  orderLabel,
  onClose,
  onSuccess,
}: TerminalPaymentProps) {
  const terminalRef = useRef<Terminal | null>(null);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [phase, setPhase] = useState<TerminalPhase>("initializing");
  const [readers, setReaders] = useState<Reader[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchConnectionToken = useCallback(async () => {
    const res = await fetch("/api/terminal/connection-token", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Connection token failed.");
    }
    return json.data.secret as string;
  }, []);

  const initializeTerminal = useCallback(async () => {
    setPhase("initializing");
    setErrorMessage(null);

    try {
      const StripeTerminal = await loadStripeTerminal();
      if (!StripeTerminal) {
        throw new Error("Stripe Terminal SDK could not be loaded.");
      }

      const terminal = StripeTerminal.create({
        onFetchConnectionToken: fetchConnectionToken,
        onUnexpectedReaderDisconnect: () => {
          setConnectedReader(null);
          setPhase("ready");
          toast.error("Reader disconnected.");
        },
      });

      terminalRef.current = terminal;
      setPhase("discovering");

      const discover = await terminal.discoverReaders({
        simulated: process.env.NODE_ENV !== "production",
      });
      if ("error" in discover && discover.error) {
        throw new Error(discover.error.message);
      }

      const discovered = "discoveredReaders" in discover
        ? (discover.discoveredReaders ?? [])
        : [];
      setReaders(discovered);

      if (discovered.length === 1) {
        setPhase("connecting");
        const connect = await terminal.connectReader(discovered[0]);
        if ("error" in connect && connect.error) {
          throw new Error(connect.error.message);
        }
        setConnectedReader("reader" in connect ? (connect.reader ?? null) : null);
        setPhase("ready");
        return;
      }

      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Terminal setup failed."
      );
    }
  }, [fetchConnectionToken]);

  useEffect(() => {
    if (!open) return;
    void initializeTerminal();

    return () => {
      terminalRef.current = null;
      setConnectedReader(null);
    };
  }, [open, initializeTerminal]);

  async function connectReader(reader: Reader) {
    const terminal = terminalRef.current;
    if (!terminal) return;

    setPhase("connecting");
    setErrorMessage(null);

    const connect = await terminal.connectReader(reader);
    if ("error" in connect && connect.error) {
      setPhase("error");
      setErrorMessage(connect.error.message);
      return;
    }

    setConnectedReader("reader" in connect ? (connect.reader ?? null) : null);
    setPhase("ready");
  }

  async function collectPayment() {
    const terminal = terminalRef.current;
    if (!terminal || !connectedReader) {
      toast.error("Connect a reader first.");
      return;
    }

    if (!orderId && !sessionId) {
      toast.error("Missing payment target.");
      return;
    }

    setPhase("creating_intent");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/terminal/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sessionId ? { sessionId } : { orderId }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Payment intent failed.");
      }

      const clientSecret = json.data.clientSecret as string;
      setPhase("waiting_for_card");

      const collected = await terminal.collectPaymentMethod(clientSecret);
      if ("error" in collected && collected.error) {
        throw new Error(collected.error.message);
      }

      setPhase("processing");
      const paymentIntent =
        "paymentIntent" in collected ? collected.paymentIntent : null;
      if (!paymentIntent) {
        throw new Error("Payment method collection failed.");
      }

      const processed = await terminal.processPayment(paymentIntent);
      if ("error" in processed && processed.error) {
        throw new Error(processed.error.message);
      }

      setPhase("success");
      toast.success("Payment successful.");
      onSuccess();
    } catch (error) {
      setPhase("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Payment could not be completed."
      );
    }
  }

  const phaseLabel: Record<TerminalPhase, string> = {
    initializing: "Initializing terminal…",
    discovering: "Discovering readers…",
    connecting: "Connecting to reader…",
    ready: "Reader connected — ready to charge",
    creating_intent: "Creating payment…",
    waiting_for_card: "Waiting for card…",
    processing: "Processing payment…",
    success: "Payment successful ✓",
    error: errorMessage ?? "Something went wrong",
  };

  const busy = [
    "initializing",
    "discovering",
    "connecting",
    "creating_intent",
    "waiting_for_card",
    "processing",
  ].includes(phase);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-dash-text">
            <CreditCard className="size-5 text-dash-accent" />
            Kartenzahlung (Terminal)
          </DialogTitle>
          <DialogDescription className="text-dash-text-secondary">
            {orderLabel ? `${orderLabel} · ` : ""}
            {formatPrice(amount, currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              phase === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : phase === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-dash-border bg-dash-bg text-dash-text-secondary"
            )}
          >
            <div className="flex items-center gap-2">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {phaseLabel[phase]}
            </div>
          </div>

          {phase === "ready" && readers.length > 1 && !connectedReader && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-dash-text-disabled">
                Select reader
              </p>
              {readers.map((reader) => (
                <button
                  key={reader.id}
                  type="button"
                  onClick={() => void connectReader(reader)}
                  className="flex w-full items-center justify-between rounded-lg border border-dash-border px-3 py-2 text-left text-sm hover:bg-dash-surface-raised"
                >
                  <span>{reader.label ?? reader.id}</span>
                  {reader.status === "online" ? (
                    <Wifi className="size-4 text-emerald-400" />
                  ) : (
                    <WifiOff className="size-4 text-dash-text-disabled" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-dash-border"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-dash-accent text-black hover:bg-dash-accent/90"
              disabled={busy || phase === "success" || !connectedReader}
              onClick={() => void collectPayment()}
            >
              Charge card
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
