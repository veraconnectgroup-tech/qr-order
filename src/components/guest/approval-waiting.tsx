"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import {
  getOrCreateDeviceFingerprint,
  setStoredDeviceToken,
} from "@/lib/guest/device-storage";
import { syncTableSessionStores } from "@/lib/guest/ensure-table-session";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { TablePinReveal } from "@/components/guest/table-pin-reveal";

export function ApprovalWaiting({
  slug,
  token,
  orderId,
  tableId,
  tableName,
  locationId,
}: {
  slug: string;
  token: string;
  orderId: string;
  tableId: string;
  tableName: string;
  locationId: string;
}) {
  const { tUI } = useAppLocale();
  const router = useRouter();
  const [tablePin, setTablePin] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fingerprint = getOrCreateDeviceFingerprint();

    async function poll() {
      const params = new URLSearchParams({
        tableToken: token,
        deviceFingerprint: fingerprint,
      });
      const res = await fetch(
        `/api/orders/${orderId}/approval-status?${params}`
      );
      if (!res.ok || cancelled) return;

      const json = (await res.json()) as {
        data?: {
          status: string;
          rejectionReason?: string | null;
          deviceBlocked?: boolean;
          sessionToken?: string;
          sessionId?: string;
          deviceToken?: string;
          tablePin?: string | null;
        };
      };

      const data = json.data;
      if (!data) return;

      if (data.status === "rejected") {
        setRejected(data.rejectionReason ?? tUI("session.approvalRejected"));
        setDeviceBlocked(Boolean(data.deviceBlocked));
        return;
      }

      if (
        data.status === "approved" &&
        data.sessionToken &&
        data.sessionId &&
        data.deviceToken
      ) {
        setStoredDeviceToken(locationId, tableId, data.deviceToken);
        syncTableSessionStores(
          slug,
          token,
          {
            sessionId: data.sessionId,
            sessionToken: data.sessionToken,
            tableId,
            tableName,
            locationId,
          },
          tableId
        );
        if (data.tablePin) {
          setTablePin(data.tablePin);
        } else {
          router.replace(`/${slug}/${token}/order/${orderId}?placed=1`);
        }
      }
    }

    void poll();
    const id = setInterval(poll, REALTIME_FALLBACK_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    orderId,
    token,
    slug,
    tableId,
    tableName,
    locationId,
    router,
    tUI,
  ]);

  if (tablePin) {
    return (
      <TablePinReveal
        tablePin={tablePin}
        onContinue={() =>
          router.replace(`/${slug}/${token}/order/${orderId}?placed=1`)
        }
      />
    );
  }

  if (rejected) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="font-semibold text-red-300">
          {tUI("session.approvalRejectedTitle")}
        </p>
        <p className="mt-2 text-sm text-red-200/80">{rejected}</p>
        {deviceBlocked && (
          <p className="mt-4 text-sm text-red-200/90">
            {tUI("session.deviceBlockedHint")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-8 text-center">
      <div className="mx-auto mb-4 size-10 animate-pulse rounded-full bg-orange-500/20" />
      <p className="text-lg font-semibold text-zinc-100">
        {tUI("session.approvalWaitingTitle")}
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        {tUI("session.approvalWaitingHint")}
      </p>
    </div>
  );
}
