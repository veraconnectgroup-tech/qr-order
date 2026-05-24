"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Monitor, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  connectPosIntegration,
  deletePosIntegration,
  deletePosTableMapping,
  disconnectPosIntegration,
  getLocationTablesForPosMapping,
  getPosIntegrations,
  getPosTableMappings,
  upsertPosTableMapping,
  type PosIntegrationRow,
  type PosProvider,
  type PosTableMappingRow,
} from "@/lib/pos/pos-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PROVIDER_LABELS: Record<PosProvider, string> = {
  deliverect: "Deliverect",
  orderbird: "Orderbird",
  lightspeed: "Lightspeed",
  ready2order: "ready2order",
  custom: "Custom",
};

function statusBadge(status: PosIntegrationRow["status"]) {
  if (status === "connected") {
    return (
      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        Verbunden
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Fehler
      </span>
    );
  }
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
      Getrennt
    </span>
  );
}

function formatSyncAt(iso: string | null) {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: de });
}

function PosTableMappingsSection({
  integrationId,
  locationId,
}: {
  integrationId: string;
  locationId: string;
}) {
  const [mappings, setMappings] = useState<PosTableMappingRow[]>([]);
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([]);
  const [externalKey, setExternalKey] = useState("");
  const [tableId, setTableId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async () => {
    const [mappingRows, tableRows] = await Promise.all([
      getPosTableMappings(integrationId),
      getLocationTablesForPosMapping(locationId),
    ]);
    setMappings(mappingRows);
    setTables(tableRows);
  }, [integrationId, locationId]);

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
    if (!externalKey.trim() || !tableId) return;
    setPending(true);
    const result = await upsertPosTableMapping(
      integrationId,
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

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Tisch-Mapping (POS → Vera)
      </p>
      {loading ? (
        <p className="mt-2 text-xs text-neutral-500">Wird geladen…</p>
      ) : (
        <>
          {mappings.length === 0 ? (
            <p className="mt-2 text-xs text-neutral-500">
              Keine Mappings — POS-Tischname muss exakt mit Vera übereinstimmen
              oder hier hinterlegt werden.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-neutral-700">
              {mappings.map((mapping) => (
                <li
                  key={mapping.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    <span className="font-mono">{mapping.external_table_key}</span>
                    {" → "}
                    {mapping.table_name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-neutral-500"
                    disabled={pending}
                    onClick={() => handleDeleteMapping(mapping.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[120px] flex-1 space-y-1">
              <Label className="text-xs">POS Tischname</Label>
              <Input
                value={externalKey}
                onChange={(e) => setExternalKey(e.target.value)}
                placeholder="z.B. Tisch 5"
                className="h-8 text-sm"
              />
            </div>
            <div className="min-w-[120px] flex-1 space-y-1">
              <Label className="text-xs">Vera Tisch</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Wählen" />
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
              size="sm"
              disabled={pending || !externalKey.trim() || !tableId}
              onClick={handleAddMapping}
            >
              Hinzufügen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function PosIntegrationsPanel({ locationId }: { locationId: string }) {
  const [rows, setRows] = useState<PosIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [provider, setProvider] = useState<PosProvider>("deliverect");
  const [apiKey, setApiKey] = useState("");
  const [channelLinkId, setChannelLinkId] = useState("");
  const [externalLocationId, setExternalLocationId] = useState("");
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await getPosIntegrations(locationId);
    setRows(data);
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const data = await getPosIntegrations(locationId);
        if (!cancelled) setRows(data);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "POS-Integrationen konnten nicht geladen werden."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  function openConnect() {
    setProvider("deliverect");
    setApiKey("");
    setChannelLinkId("");
    setExternalLocationId("");
    setDialogOpen(true);
  }

  async function handleConnect() {
    if (!apiKey.trim()) return;
    if (provider === "deliverect" && !channelLinkId.trim()) {
      toast.error("Channel Link ID ist für Deliverect erforderlich.");
      return;
    }

    setPending(true);
    const config: Record<string, unknown> = { api_key: apiKey.trim() };
    if (provider === "deliverect") {
      config.channel_link_id = channelLinkId.trim();
    }

    const result = await connectPosIntegration(
      locationId,
      provider,
      externalLocationId.trim() || null,
      config
    );
    setPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("POS-Integration verbunden");
    if ("webhookSecret" in result && result.webhookSecret) {
      toast.message("Webhook secret (einmalig notieren)", {
        description: result.webhookSecret,
        duration: 20_000,
      });
    }
    setDialogOpen(false);
    await reload();
  }

  async function handleDisconnect(integrationId: string) {
    setBusyId(integrationId);
    const result = await disconnectPosIntegration(integrationId);
    setBusyId(null);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("POS-Integration getrennt");
    await reload();
  }

  async function handleDelete(integrationId: string) {
    setBusyId(integrationId);
    const result = await deletePosIntegration(integrationId);
    setBusyId(null);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("POS-Integration gelöscht");
    await reload();
  }

  return (
    <div className="max-w-2xl rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">POS-Integration</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Kassensystem-Anbindung für diesen Standort. Bei aktiver Verbindung
            werden Bestellungen an das POS weitergeleitet.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openConnect}>
          <Plus className="mr-2 size-4" />
          Verbinden
        </Button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Wird geladen…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          Noch keine POS-Integrationen konfiguriert.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-100">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                  <Monitor className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-900">
                      {PROVIDER_LABELS[row.provider]}
                    </p>
                    {statusBadge(row.status)}
                  </div>
                  {row.external_location_id && (
                    <p className="mt-1 text-sm text-neutral-500">
                      Externe Standort-ID: {row.external_location_id}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    Letzte Sync: {formatSyncAt(row.last_sync_at)}
                  </p>
                  {row.status === "connected" && (
                    <p className="mt-1 font-mono text-xs text-neutral-500">
                      Inbound: /api/pos/inbound/{row.id}
                    </p>
                  )}
                  {row.status === "error" && row.last_error && (
                    <p className="mt-2 text-sm text-red-600">{row.last_error}</p>
                  )}
                  {row.status === "connected" && (
                    <PosTableMappingsSection
                      integrationId={row.id}
                      locationId={locationId}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {row.status === "connected" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => handleDisconnect(row.id)}
                  >
                    Trennen
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => handleDelete(row.id)}
                >
                  <Trash2 className="mr-1 size-4" />
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>POS verbinden</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="posProvider">Anbieter</Label>
              <Select
                value={provider}
                onValueChange={(value) => setProvider(value as PosProvider)}
              >
                <SelectTrigger id="posProvider">
                  <SelectValue placeholder="Anbieter wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_LABELS) as PosProvider[]).map(
                    (id) => (
                      <SelectItem key={id} value={id}>
                        {PROVIDER_LABELS[id]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="posExternalLocationId">Externe Standort-ID</Label>
              <Input
                id="posExternalLocationId"
                value={externalLocationId}
                onChange={(e) => setExternalLocationId(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posApiKey">API-Schlüssel</Label>
              <Input
                id="posApiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="POS API-Schlüssel"
                autoComplete="off"
              />
            </div>
            {provider === "deliverect" && (
              <div className="space-y-2">
                <Label htmlFor="posChannelLinkId">Channel Link ID</Label>
                <Input
                  id="posChannelLinkId"
                  value={channelLinkId}
                  onChange={(e) => setChannelLinkId(e.target.value)}
                  placeholder="Deliverect channelLinkId"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={
                pending ||
                !apiKey.trim() ||
                (provider === "deliverect" && !channelLinkId.trim())
              }
              onClick={handleConnect}
            >
              {pending ? "Wird verbunden…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
