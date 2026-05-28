"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { updateOrgFiscalFields } from "@/lib/admin/fiscal-settings-actions";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TseSettingsPanel({
  tssId,
  clientId,
  steuernummer: initialSteuernummer,
  ustIdNr: initialUstIdNr,
  platformConfigured,
}: {
  tssId: string | null;
  clientId: string | null;
  steuernummer: string | null;
  ustIdNr: string | null;
  platformConfigured: boolean;
}) {
  const [activeTssId, setActiveTssId] = useState(tssId);
  const [activeClientId, setActiveClientId] = useState(clientId);
  const [steuernummer, setSteuernummer] = useState(initialSteuernummer ?? "");
  const [ustIdNr, setUstIdNr] = useState(initialUstIdNr ?? "");
  const [loading, setLoading] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fiscalError, setFiscalError] = useState<string | null>(null);
  const [fiscalSuccess, setFiscalSuccess] = useState<string | null>(null);

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

  async function handleSaveFiscalFields() {
    setSavingFiscal(true);
    setFiscalError(null);
    setFiscalSuccess(null);

    const formData = new FormData();
    formData.set("steuernummer", steuernummer.trim());
    formData.set("ust_id_nr", ustIdNr.trim());

    const result = await updateOrgFiscalFields(formData);

    if (result?.error) {
      setFiscalError(result.error);
    } else {
      setFiscalSuccess("Fiskaldaten gespeichert.");
    }

    setSavingFiscal(false);
  }

  return (
    <AdminPanel title="TSE (KassenSichV)" description="Fiskaly Cloud-TSE für gesetzeskonforme Beleg-Signaturen.">
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 items-center justify-center rounded-lg ${
            isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
          }`}
        >
          {isActive ? (
            <ShieldCheck className="size-5" />
          ) : (
            <ShieldOff className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1" />
      </div>

      <div className="mt-4">
        {isActive ? (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
            TSE aktiv
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            TSE nicht konfiguriert
          </span>
        )}
      </div>

      {isActive && (
        <dl className="mt-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between gap-4">
            <dt>TSS ID</dt>
            <dd className="truncate font-mono text-foreground">{activeTssId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Client ID</dt>
            <dd className="truncate font-mono text-foreground">
              {activeClientId}
            </dd>
          </div>
        </dl>
      )}

      {!platformConfigured && (
        <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
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
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <div className="mt-6 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Fiskaldaten</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Steuernummer oder USt-IdNr erscheint auf dem gesetzlichen Beleg (§14
          UStG).
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="steuernummer">Steuernummer</Label>
            <Input
              id="steuernummer"
              value={steuernummer}
              onChange={(e) => setSteuernummer(e.target.value)}
              placeholder="123/456/78901"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ust_id_nr">USt-IdNr</Label>
            <Input
              id="ust_id_nr"
              value={ustIdNr}
              onChange={(e) => setUstIdNr(e.target.value)}
              placeholder="DE123456789"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={savingFiscal}
            onClick={handleSaveFiscalFields}
          >
            {savingFiscal ? "Speichern…" : "Fiskaldaten speichern"}
          </Button>
        </div>

        {fiscalError && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-300">
            {fiscalError}
          </p>
        )}

        {fiscalSuccess && (
          <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {fiscalSuccess}
          </p>
        )}
      </div>
    </AdminPanel>
  );
}
