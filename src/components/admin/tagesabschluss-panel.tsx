"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { FileText, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import type { DailyClosingRow } from "@/lib/fiscal/daily-closing";

function formatBusinessDateLabel(businessDate: string) {
  return format(parseISO(`${businessDate}T12:00:00`), "dd.MM.yyyy (EEEE)", {
    locale: de,
  });
}

export function TagesabschlussPanel({
  closings: initialClosings,
  locationId,
  defaultBusinessDate,
  currency,
}: {
  closings: DailyClosingRow[];
  locationId: string;
  defaultBusinessDate: string;
  currency: string;
}) {
  const [closings] = useState(initialClosings);
  const [businessDate, setBusinessDate] = useState(defaultBusinessDate);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleManualClosing() {
    setRunning(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/fiscal/daily-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, businessDate }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { id: string; orderCount: number; totalGross: number };
      };

      if (!res.ok) {
        throw new Error(json.error ?? "Tagesabschluss fehlgeschlagen.");
      }

      setSuccess(
        `Tagesabschluss für ${businessDate} erstellt (${json.data?.orderCount ?? 0} Bestellungen).`
      );
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tagesabschluss fehlgeschlagen.");
    } finally {
      setRunning(false);
    }
  }

  function openZBon(closingId: string) {
    window.open(`/api/fiscal/daily-closing/${closingId}/z-bon`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tagesabschlüsse</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Z-Bon / Kassenabschluss gemäß KassenSichV (standalone Modus).
        </p>
      </div>

      <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Manueller Abschluss</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Erstellt oder aktualisiert den Tagesabschluss für ein gewähltes Datum.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="businessDate">Geschäftstag</Label>
            <Input
              id="businessDate"
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={running || !businessDate}
            onClick={handleManualClosing}
          >
            <PlayCircle className="mr-2 size-4" />
            {running ? "Wird erstellt…" : "Tagesabschluss ausführen"}
          </Button>
        </div>
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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold">Letzte 30 Tage</h2>
        </div>

        {closings.length === 0 ? (
          <p className="px-6 py-8 text-sm text-neutral-500">
            Noch keine Tagesabschlüsse vorhanden.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {closings.map((closing) => {
              const signed = Boolean(closing.tse_closing_signature);
              const vatSummary = closing.vat_summary ?? [];

              return (
                <div key={closing.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {formatBusinessDateLabel(closing.business_date)}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600">
                        {closing.order_count} Bestellungen ·{" "}
                        {formatPrice(Number(closing.total_gross), currency)} brutto
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        Bar {formatPrice(Number(closing.total_cash), currency)} ·
                        Unbar{" "}
                        {formatPrice(Number(closing.total_non_cash), currency)}
                      </p>
                      {vatSummary.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {vatSummary.map((row) => (
                            <span
                              key={row.rate}
                              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
                            >
                              MwSt {row.rate}%:{" "}
                              {formatPrice(row.gross, currency)}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-xs">
                        <span
                          className={
                            signed
                              ? "font-medium text-green-700"
                              : "font-medium text-amber-700"
                          }
                        >
                          TSE: {signed ? "signiert" : "nicht signiert"}
                        </span>
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openZBon(closing.id)}
                    >
                      <FileText className="mr-2 size-4" />
                      Z-Bon anzeigen
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
