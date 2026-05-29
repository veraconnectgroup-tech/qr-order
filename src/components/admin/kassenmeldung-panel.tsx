"use client";

import { useState } from "react";
import { FileDown, Plus } from "lucide-react";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FiscalRegistrationRow } from "@/lib/fiscal/kassenmeldung";

type RegisterOption = {
  id: string;
  kassen_id: string;
  location_id: string;
  location_name: string;
};

export function KassenmeldungPanel({
  registrations,
  registers,
  locationId,
}: {
  registrations: FiscalRegistrationRow[];
  registers: RegisterOption[];
  locationId: string;
}) {
  const [rows, setRows] = useState(registrations);
  const [registerId, setRegisterId] = useState(registers[0]?.id ?? "");
  const [kassenId, setKassenId] = useState(registers[0]?.kassen_id ?? "");
  const [inbetriebnahmeAt, setInbetriebnahmeAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [tssSerial, setTssSerial] = useState("");
  const [elsterKennung, setElsterKennung] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onRegisterChange(nextRegisterId: string) {
    setRegisterId(nextRegisterId);
    const match = registers.find((row) => row.id === nextRegisterId);
    if (match) {
      setKassenId(match.kassen_id);
    }
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/fiscal/kassenmeldung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          registerId,
          kassenId: kassenId.trim(),
          inbetriebnahmeAt,
          tssSerial: tssSerial.trim() || null,
          elsterKennung: elsterKennung.trim() || null,
        }),
      });

      const json = (await res.json()) as {
        error?: string;
        data?: { id: string };
      };

      if (!res.ok) {
        throw new Error(json.error ?? "Kassenmeldung fehlgeschlagen.");
      }

      setSuccess("Kassenmeldung gespeichert.");
      const listRes = await fetch("/api/fiscal/kassenmeldung");
      const listJson = (await listRes.json()) as {
        data?: { registrations: FiscalRegistrationRow[] };
      };
      if (listJson.data?.registrations) {
        setRows(listJson.data.registrations);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kassenmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    window.location.href = "/api/fiscal/kassenmeldung?export=csv";
  }

  return (
    <AdminPanel
      title="Kassenmeldepflicht"
      description="§146a Abs. 4 AO — Registrierung der Kasse für ELSTER"
    >
      <div className="space-y-6">
        {registers.length === 0 ? (
          <p className="text-sm text-dash-text-muted">
            Keine Fiskaly-Kasse für diesen Standort provisioniert. Aktiviere TSE
            unter Einstellungen, dann Register pro Standort.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="register">Register</Label>
              <select
                id="register"
                className="flex h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                value={registerId}
                onChange={(e) => onRegisterChange(e.target.value)}
              >
                {registers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.location_name} — {row.kassen_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kassenId">Kassen-ID (ELSTER)</Label>
              <Input
                id="kassenId"
                value={kassenId}
                onChange={(e) => setKassenId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inbetriebnahme">Inbetriebnahme</Label>
              <Input
                id="inbetriebnahme"
                type="date"
                value={inbetriebnahmeAt}
                onChange={(e) => setInbetriebnahmeAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tssSerial">TSE-Seriennummer</Label>
              <Input
                id="tssSerial"
                value={tssSerial}
                onChange={(e) => setTssSerial(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="elster">ELSTER-Kennung</Label>
              <Input
                id="elster"
                value={elsterKennung}
                onChange={(e) => setElsterKennung(e.target.value)}
                placeholder="Nach Übermittlung an Finanzamt"
              />
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {success ? <p className="text-sm text-green-400">{success}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={loading || !registerId || !kassenId.trim()}
          >
            <Plus className="mr-2 size-4" />
            Meldung erfassen
          </Button>
          <Button type="button" variant="outline" onClick={handleExport}>
            <FileDown className="mr-2 size-4" />
            CSV exportieren
          </Button>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-dash-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-dash-surface text-dash-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Kassen-ID</th>
                  <th className="px-3 py-2 font-medium">Inbetriebnahme</th>
                  <th className="px-3 py-2 font-medium">Außerbetriebnahme</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-dash-border">
                    <td className="px-3 py-2 text-dash-text">{row.kassen_id}</td>
                    <td className="px-3 py-2 text-dash-text-muted">
                      {row.inbetriebnahme_at}
                    </td>
                    <td className="px-3 py-2 text-dash-text-muted">
                      {row.ausserbetriebnahme_at ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-dash-text-muted">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AdminPanel>
  );
}
