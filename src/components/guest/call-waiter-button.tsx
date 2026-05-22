"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { WAITER_CALL_COOLDOWN_SECONDS } from "@/lib/constants";
import { useGuestSession } from "@/hooks/use-guest-session";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function CallWaiterButton({
  token,
  tableName,
}: {
  token: string;
  tableName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const sessionToken = useGuestSession((s) => s.sessionToken);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(WAITER_CALL_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleCall() {
    if (!sessionToken) {
      toast.error("Session not active", {
        description: "Refresh the page and try again.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/waiter-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken: token,
          sessionToken,
        }),
      });
      if (!res.ok) throw new Error();
      setConfirmed(true);
      startCooldown();
    } catch {
      toast.error("Could not call waiter", { description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="border-zinc-700 bg-transparent text-zinc-200"
        onClick={() => {
          setConfirmed(false);
          setOpen(true);
        }}
        disabled={cooldown > 0}
      >
        <BellRing className="mr-2 size-4" />
        {cooldown > 0 ? `Wait ${cooldown}s` : "Call waiter"}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-zinc-800 bg-zinc-900 text-zinc-50"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700" />
          {!confirmed ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-zinc-50">Call waiter?</SheetTitle>
              </SheetHeader>
              <p className="mt-2 text-body text-zinc-400">
                Staff will be notified to come to {tableName}.
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  onClick={handleCall}
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {loading ? "Sending..." : "Call waiter"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="text-zinc-50">Waiter notified ✓</SheetTitle>
              </SheetHeader>
              <p className="mt-2 text-body text-zinc-400">
                Someone will be with you shortly.
              </p>
              <Button
                className="mt-6 w-full bg-orange-500 hover:bg-orange-600"
                onClick={() => setOpen(false)}
              >
                OK
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
