"use client";

import {
  getOrCreateDeviceFingerprint,
  setStoredDeviceToken,
} from "@/lib/guest/device-storage";
import { syncTableSessionStores } from "@/lib/guest/ensure-table-session";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";

export type DenisOrderSubmitPayload = {
  orderId: string;
  orderNumber: number;
  awaitingApproval?: boolean;
  sessionOpened?: {
    sessionId: string;
    sessionToken: string;
    deviceToken: string;
    tablePin?: string;
  };
};

export function applyDenisOrderSessionOpened(input: {
  slug: string;
  tableToken: string;
  locationId: string;
  tableId: string;
  tableName: string;
  sessionOpened: NonNullable<DenisOrderSubmitPayload["sessionOpened"]>;
}) {
  setStoredDeviceToken(
    input.locationId,
    input.tableId,
    input.sessionOpened.deviceToken
  );
  syncTableSessionStores(
    input.slug,
    input.tableToken,
    {
      sessionId: input.sessionOpened.sessionId,
      sessionToken: input.sessionOpened.sessionToken,
      tableId: input.tableId,
      tableName: input.tableName,
      locationId: input.locationId,
    },
    input.tableId
  );
}

export function pollDenisApprovalPin(input: {
  orderId: string;
  tableToken: string;
  slug: string;
  locationId: string;
  tableId: string;
  tableName: string;
  onPin: (tablePin: string) => void;
  onRejected?: (reason: string | null) => void;
}): () => void {
  let cancelled = false;
  let pollIntervalId: ReturnType<typeof setInterval> | undefined;
  const fingerprint = getOrCreateDeviceFingerprint();

  function stopPolling() {
    if (pollIntervalId !== undefined) {
      clearInterval(pollIntervalId);
      pollIntervalId = undefined;
    }
  }

  async function poll() {
    if (cancelled) return;

    const params = new URLSearchParams({
      tableToken: input.tableToken,
      deviceFingerprint: fingerprint,
    });

    const res = await fetch(
      `/api/orders/${input.orderId}/approval-status?${params}`
    );
    if (!res.ok || cancelled) return;

    const json = (await res.json()) as {
      data?: {
        status: string;
        rejectionReason?: string | null;
        sessionToken?: string;
        sessionId?: string;
        deviceToken?: string;
        tablePin?: string | null;
      };
    };

    const data = json.data;
    if (!data) return;

    if (data.status === "rejected") {
      stopPolling();
      input.onRejected?.(data.rejectionReason ?? null);
      return;
    }

    if (data.status === "approved" && data.sessionToken && data.sessionId) {
      if (data.deviceToken) {
        setStoredDeviceToken(input.locationId, input.tableId, data.deviceToken);
      }
      syncTableSessionStores(
        input.slug,
        input.tableToken,
        {
          sessionId: data.sessionId,
          sessionToken: data.sessionToken,
          tableId: input.tableId,
          tableName: input.tableName,
          locationId: input.locationId,
        },
        input.tableId
      );
      if (data.tablePin) {
        stopPolling();
        input.onPin(data.tablePin);
      }
    }
  }

  void poll();
  pollIntervalId = setInterval(poll, REALTIME_FALLBACK_POLL_MS);

  return () => {
    cancelled = true;
    stopPolling();
  };
}
