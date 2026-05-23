"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TseSettingsPanel({
  tssId,
  clientId,
  platformConfigured,
}: {
  tssId: string | null;
  clientId: string | null;
  platformConfigured: boolean;
}) {
  const [activeTssId, setActiveTssId] = useState(tssId);
  const [activeClientId, setActiveClientId] = useState(clientId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isActive = Boolean(activeTssId && activeClientId);

  async function handleActivate() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/fiscal/provision", { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        data?: { tssId: string; clientId: string; skipped: boolean };
      };

      if (!res.ok) {
        throw new Error(json.error ?? "TSE activation failed.");
      }

      if (json.data) {
        setActiveTssId(json.data.tssId);
        setActiveClientId(json.data.clientId);
        setSuccess(
          json.data.skipped
            ? "TSE war bereits aktiv."
            : "TSE erfolgreich aktiviert."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "TSE activation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 items-center justify-center rounded-lg ${
            isActive ? "bg-green-50 text-green-600" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {isActive ? (
            <ShieldCheck className="size-5" />
          ) : (
            <ShieldOff className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">TSE (KassenSichV)</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Fiskaly Cloud-TSE für gesetzeskonforme Beleg-Signaturen.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {isActive ? (
          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
            TSE aktiv
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-600">
            TSE nicht konfiguriert
          </span>
        )}
      </div>

      {isActive && (
        <dl className="mt-4 space-y-2 text-xs text-neutral-500">
          <div className="flex justify-between gap-4">
            <dt>TSS ID</dt>
            <dd className="truncate font-mono text-neutral-700">{activeTssId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Client ID</dt>
            <dd className="truncate font-mono text-neutral-700">
              {activeClientId}
            </dd>
          </div>
        </dl>
      )}

      {!platformConfigured && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Platform Fiskaly credentials are not set. Contact support to enable
          TSE provisioning.
        </p>
      )}

      {platformConfigured && !isActive && (
        <Button
          type="button"
          className="mt-4"
          disabled={loading}
          onClick={handleActivate}
        >
          {loading ? "Aktiviere TSE…" : "TSE aktivieren"}
        </Button>
      )}

      {platformConfigured && isActive && (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={loading}
          onClick={handleActivate}
        >
          {loading ? "Prüfe TSE…" : "TSE erneut prüfen"}
        </Button>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </p>
      )}
    </div>
  );
}
