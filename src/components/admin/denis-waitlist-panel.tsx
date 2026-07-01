"use client";

import { useTransition } from "react";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { Button } from "@/components/ui/button";
import type { WaitlistAdminSnapshot } from "@/lib/admin/load-waitlist-admin-snapshot";

type Props = {
  snapshot: WaitlistAdminSnapshot;
  locationId: string;
};

export function DenisWaitlistPanel({ snapshot, locationId }: Props) {
  const [pending, startTransition] = useTransition();

  function notifyGuest(entryId: string) {
    startTransition(async () => {
      await fetch("/api/commerce/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, entryId, action: "notify" }),
      });
    });
  }

  function seatGuest(entryId: string) {
    startTransition(async () => {
      await fetch("/api/commerce/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, entryId, action: "seat" }),
      });
    });
  }

  return (
    <QrCard>
      <QrCardTitle>Waitlist ({snapshot.queueLength} u redu)</QrCardTitle>
      <QrCardDescription>
        Entrance QR · avg turnover {snapshot.config.avgTurnoverMinutes} min ·
        no-show {snapshot.config.noShowTimeoutMinutes} min
      </QrCardDescription>

      {snapshot.rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Red je prazan.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {snapshot.rows.map((row) => (
            <li
              key={row.entryId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
            >
              <div>
                <p className="font-medium">
                  {row.position}. {row.guestName} ({row.partySize} osobe)
                </p>
                <p className="text-xs text-muted-foreground">
                  Čeka {row.waitedMinutes} min · sto za ~{row.estimatedMinutes} min · {row.status}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || row.status === "seated"}
                  onClick={() => notifyGuest(row.entryId)}
                >
                  Obavijesti
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || row.status === "seated"}
                  onClick={() => seatGuest(row.entryId)}
                >
                  Sjedio
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending || row.status === "seated"}
                  onClick={() => {
                    startTransition(async () => {
                      await fetch("/api/commerce/waitlist", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          locationId,
                          entryId: row.entryId,
                          action: "no_show",
                        }),
                      });
                    });
                  }}
                >
                  Preskoči
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </QrCard>
  );
}
