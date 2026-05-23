"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "März" },
  { value: 4, label: "April" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Dezember" },
];

function monthRange(year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return { from, to };
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DatevExportPanel() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i);
  }, [now]);

  const { from, to } = monthRange(year, month);

  async function handleDownload() {
    setDownloading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: toIsoDate(from),
        to: toIsoDate(to),
      });

      const res = await fetch(`/api/export/datev?${params.toString()}`);

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Export failed.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename =
        filenameMatch?.[1] ??
        `DATEV_Export_${toIsoDate(from)}_${toIsoDate(to)}.csv`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <FileSpreadsheet className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            DATEV Export
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Monatlicher CSV-Export für die Buchhaltung (SKR03: 8400/8300 Erlöse,
            1200 Bank, 1000 Kasse).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-neutral-700">Monat</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="block min-w-[160px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-neutral-700">Jahr</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="block min-w-[120px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <Button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-2"
        >
          <FileSpreadsheet className="size-4" />
          {downloading ? "Exportiere…" : "DATEV Export"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Zeitraum: {toIsoDate(from)} – {toIsoDate(to)} · Online-Zahlungen → Konto
        1200 · Bar/Tisch → Konto 1000
      </p>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
