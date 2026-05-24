"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Link2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  bulkImportPosTableMappings,
  deletePosTableMapping,
  getLocationTablesForPosMapping,
  getPosIntegrations,
  getPosTableMappingsForLocation,
  upsertPosTableMapping,
  type PosIntegrationRow,
  type PosProvider,
  type PosTableMappingRow,
} from "@/lib/pos/pos-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const POS_PROVIDER_LABELS: Record<PosProvider, string> = {
  deliverect: "Deliverect",
  orderbird: "Orderbird",
  lightspeed: "Lightspeed",
  ready2order: "ready2order",
  custom: "Custom",
};

type ParsedBulkRow = {
  externalTableKey: string;
  veraTableName: string;
};

export function parseBulkMappingText(text: string): ParsedBulkRow[] {
  const rows: ParsedBulkRow[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.includes(",")
      ? line.split(",").map((part) => part.trim())
      : line.split(/\t+/).map((part) => part.trim());

    if (parts.length < 2) continue;

    const [externalTableKey, veraTableName] = parts;
    if (!externalTableKey || !veraTableName) continue;

    rows.push({ externalTableKey, veraTableName });
  }

  return rows;
}

function resolveBulkRows(
  parsed: ParsedBulkRow[],
  tables: Array<{ id: string; name: string }>
): {
  rows: Array<{ externalTableKey: string; tableId: string }>;
  errors: string[];
} {
  const nameToId = new Map(
    tables.map((table) => [table.name.trim().toLowerCase(), table.id])
  );
  const rows: Array<{ externalTableKey: string; tableId: string }> = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    const dedupeKey = entry.externalTableKey.toLowerCase();
    if (seen.has(dedupeKey)) {
      errors.push(`Duplicate POS name: "${entry.externalTableKey}"`);
      continue;
    }
    seen.add(dedupeKey);

    const tableId = nameToId.get(entry.veraTableName.toLowerCase());
    if (!tableId) {
      errors.push(
        `No Vera table named "${entry.veraTableName}" for POS "${entry.externalTableKey}".`
      );
      continue;
    }

    rows.push({ externalTableKey: entry.externalTableKey, tableId });
  }

  return { rows, errors };
}

export function TableMappingsPanel({ locationId }: { locationId: string }) {
  const [integrations, setIntegrations] = useState<PosIntegrationRow[]>([]);
  const [mappings, setMappings] = useState<PosTableMappingRow[]>([]);
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([]);
  const [providerFilter, setProviderFilter] = useState<PosProvider | "all">(
    "all"
  );
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("");
  const [externalKey, setExternalKey] = useState("");
  const [tableId, setTableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const connectedIntegrations = useMemo(
    () => integrations.filter((row) => row.status === "connected"),
    [integrations]
  );

  const selectedIntegration = useMemo(
    () =>
      connectedIntegrations.find((row) => row.id === selectedIntegrationId) ??
      connectedIntegrations[0] ??
      null,
    [connectedIntegrations, selectedIntegrationId]
  );

  const filteredMappings = useMemo(() => {
    if (providerFilter === "all") return mappings;
    return mappings.filter((row) => row.provider === providerFilter);
  }, [mappings, providerFilter]);

  const reload = useCallback(async () => {
    const [integrationRows, mappingRows, tableRows] = await Promise.all([
      getPosIntegrations(locationId),
      getPosTableMappingsForLocation(
        locationId,
        providerFilter === "all" ? undefined : providerFilter
      ),
      getLocationTablesForPosMapping(locationId),
    ]);

    setIntegrations(integrationRows);
    setMappings(mappingRows);
    setTables(tableRows);

    const connected = integrationRows.filter((row) => row.status === "connected");
    setSelectedIntegrationId((current) => {
      if (current && connected.some((row) => row.id === current)) return current;
      return connected[0]?.id ?? "";
    });
  }, [locationId, providerFilter]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        await reload();
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Tisch-Mappings konnten nicht geladen werden."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function handleAddMapping() {
    if (!selectedIntegration || !externalKey.trim() || !tableId) return;

    const duplicate = mappings.some(
      (row) =>
        row.provider === selectedIntegration.provider &&
        row.external_table_key.toLowerCase() === externalKey.trim().toLowerCase()
    );

    if (duplicate) {
      toast.error(
        "Dieser POS-Tischname ist für diesen Anbieter bereits gemappt."
      );
      return;
    }

    setPending(true);
    const result = await upsertPosTableMapping(
      selectedIntegration.id,
      externalKey.trim(),
      tableId
    );
    setPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    setExternalKey("");
    setTableId("");
    toast.success("Tisch-Mapping gespeichert");
    await reload();
  }

  async function handleDeleteMapping(mappingId: string) {
    setPending(true);
    const result = await deletePosTableMapping(mappingId);
    setPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Mapping entfernt");
    await reload();
  }

  async function handleBulkImport() {
    if (!selectedIntegration) {
      toast.error("Bitte zuerst eine POS-Integration verbinden.");
      return;
    }

    const parsed = parseBulkMappingText(importText);
    if (!parsed.length) {
      toast.error("Keine gültigen Zeilen gefunden.");
      return;
    }

    const { rows, errors } = resolveBulkRows(parsed, tables);
    if (errors.length) {
      toast.error(errors[0] ?? "Import konnte nicht verarbeitet werden.");
      return;
    }

    if (!rows.length) {
      toast.error("Keine gültigen Mappings zum Import.");
      return;
    }

    setPending(true);
    const result = await bulkImportPosTableMappings(selectedIntegration.id, rows);
    setPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`${result.imported} Mappings importiert`);
    setImportText("");
    setImportOpen(false);
    await reload();
  }

  async function handleCsvFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setImportText(text);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-500">Wird geladen…</p>
      </div>
    );
  }

  if (connectedIntegrations.length === 0) {
    return (
      <div className="max-w-3xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Link2 className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              POS Tisch-Mapping
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Verbinden Sie zuerst ein Kassensystem, damit eingehende
              POS-Bestellungen dem richtigen Vera-Tisch zugeordnet werden können.
            </p>
            <Button type="button" className="mt-4" asChild>
              <Link href="/admin/pos-integrations">
                Zur POS-Integration
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              POS → Vera Tisch-Mapping
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Ordnen Sie POS-Tischbezeichnungen Vera-Tischen zu. Ohne Mapping
              versucht Vera exakte Namensübereinstimmung oder die
              Standard-Tisch-Konfiguration.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-2 size-4" />
            Bulk-Import
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mappingProviderFilter">Anbieter filtern</Label>
            <Select
              value={providerFilter}
              onValueChange={(value) =>
                setProviderFilter(value as PosProvider | "all")
              }
            >
              <SelectTrigger id="mappingProviderFilter">
                <SelectValue placeholder="Alle Anbieter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Anbieter</SelectItem>
                {(Object.keys(POS_PROVIDER_LABELS) as PosProvider[]).map(
                  (provider) => (
                    <SelectItem key={provider} value={provider}>
                      {POS_PROVIDER_LABELS[provider]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mappingIntegration">POS-Integration</Label>
            <Select
              value={selectedIntegration?.id ?? ""}
              onValueChange={setSelectedIntegrationId}
            >
              <SelectTrigger id="mappingIntegration">
                <SelectValue placeholder="Integration wählen" />
              </SelectTrigger>
              <SelectContent>
                {connectedIntegrations.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {POS_PROVIDER_LABELS[row.provider]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Neues Mapping
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs">POS Tischname</Label>
              <Input
                value={externalKey}
                onChange={(e) => setExternalKey(e.target.value)}
                placeholder="z.B. Tisch 5, T12"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vera Tisch</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tisch wählen" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              disabled={pending || !externalKey.trim() || !tableId}
              onClick={handleAddMapping}
            >
              <Plus className="mr-2 size-4" />
              Hinzufügen
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h3 className="font-semibold text-neutral-900">
            Aktive Mappings ({filteredMappings.length})
          </h3>
        </div>

        {filteredMappings.length === 0 ? (
          <p className="px-6 py-8 text-sm text-neutral-500">
            Noch keine Mappings für diesen Filter. Fügen Sie oben ein Mapping
            hinzu oder importieren Sie eine Liste.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-6 py-3 font-medium">POS Tischname</th>
                  <th className="px-6 py-3 font-medium">Vera Tisch</th>
                  <th className="px-6 py-3 font-medium">Anbieter</th>
                  <th className="px-6 py-3 font-medium text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredMappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-neutral-50/80">
                    <td className="px-6 py-3 font-mono text-neutral-900">
                      {mapping.external_table_key}
                    </td>
                    <td className="px-6 py-3 text-neutral-700">
                      {mapping.table_name}
                    </td>
                    <td className="px-6 py-3">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {POS_PROVIDER_LABELS[mapping.provider]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleDeleteMapping(mapping.id)}
                        aria-label={`Mapping ${mapping.external_table_key} löschen`}
                      >
                        <Trash2 className="size-4 text-neutral-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk-Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-neutral-500">
              Eine Zeile pro Mapping. Format:{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">
                POS Name, Vera Tischname
              </code>
              . Kommentare mit <code className="text-xs">#</code> sind erlaubt.
            </p>
            <div className="space-y-2">
              <Label htmlFor="bulkCsvFile">CSV-Datei (optional)</Label>
              <Input
                id="bulkCsvFile"
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={(e) => void handleCsvFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulkImportText">Mapping-Liste</Label>
              <Textarea
                id="bulkImportText"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                placeholder={`# POS Name, Vera Tischname\nTisch 5, Table 5\nT12, Tisch 12`}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={pending || !importText.trim()}
              onClick={handleBulkImport}
            >
              {pending ? "Importiert…" : "Importieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
