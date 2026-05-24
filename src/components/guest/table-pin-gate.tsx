"use client";

import { useState } from "react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import {
  getOrCreateDeviceFingerprint,
  setStoredDeviceToken,
} from "@/lib/guest/device-storage";
import { syncTableSessionStores } from "@/lib/guest/ensure-table-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TablePinGate({
  slug,
  tableToken,
  tableId,
  locationId,
  tableName,
  onVerified,
}: {
  slug: string;
  tableToken: string;
  tableId: string;
  locationId: string;
  tableName: string;
  onVerified: () => void;
}) {
  const { tUI } = useAppLocale();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 4) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/tables/${encodeURIComponent(tableToken)}/pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableToken,
            tablePin: pin,
            deviceFingerprint: getOrCreateDeviceFingerprint(),
          }),
        }
      );

      const json = (await res.json()) as {
        error?: string;
        data?: {
          sessionToken: string;
          sessionId: string;
          deviceToken: string;
        };
      };

      if (!res.ok || !json.data) {
        throw new Error(json.error ?? tUI("session.pinInvalid"));
      }

      setStoredDeviceToken(locationId, tableId, json.data.deviceToken);
      syncTableSessionStores(
        slug,
        tableToken,
        {
          sessionId: json.data.sessionId,
          sessionToken: json.data.sessionToken,
          tableId,
          tableName,
          locationId,
        },
        tableId
      );
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : tUI("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
      <h2 className="text-lg font-semibold text-zinc-50">
        {tUI("session.pinTitle")}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">{tUI("session.pinHint")}</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="0000"
          className="h-14 border-zinc-700 bg-zinc-950 text-center text-2xl tracking-[0.5em] text-zinc-100"
          autoComplete="off"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button
          type="submit"
          disabled={pin.length !== 4 || loading}
          className="h-12 w-full rounded-xl bg-orange-500 font-bold hover:bg-orange-600"
        >
          {loading ? tUI("session.pinVerifying") : tUI("session.pinSubmit")}
        </Button>
      </form>
    </div>
  );
}
