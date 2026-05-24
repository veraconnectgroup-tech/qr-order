"use client";

import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Plug, Store } from "lucide-react";
import { toast } from "sonner";
import {
  connectPosIntegration,
  disconnectPosIntegration,
  type PosIntegrationRow,
  type PosProvider,
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

const PROVIDERS: Array<{ id: PosProvider; label: string }> = [
  { id: "deliverect", label: "Deliverect" },
  { id: "orderbird", label: "Orderbird" },
  { id: "lightspeed", label: "Lightspeed" },
  { id: "ready2order", label: "ready2order" },
  { id: "custom", label: "Custom" },
];

function statusBadge(status: PosIntegrationRow["status"]) {
  if (status === "connected") {
    return (
      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        Connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Error
      </span>
    );
  }
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
      Disconnected
    </span>
  );
}

function formatSyncAt(iso: string | null) {
  if (!iso) return "—";
  return format(new Date(iso), "dd.MM.yyyy HH:mm", { locale: de });
}

export function PosIntegrationsPanel({
  integrations,
  locationId,
}: {
  integrations: PosIntegrationRow[];
  locationId: string;
}) {
  const [rows, setRows] = useState(integrations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PosProvider | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");
  const [externalLocationId, setExternalLocationId] = useState("");
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  function openConnect(provider: PosProvider) {
    setSelectedProvider(provider);
    setApiKey("");
    setExternalLocationId("");
    setDialogOpen(true);
  }

  async function handleConnect() {
    if (!selectedProvider || !apiKey.trim()) return;
    setPending(true);
    const result = await connectPosIntegration({
      locationId,
      provider: selectedProvider,
      apiKey: apiKey.trim(),
      externalLocationId: externalLocationId.trim() || undefined,
    });
    setPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("POS integration connected");
    setDialogOpen(false);
    window.location.reload();
  }

  async function handleDisconnect(integrationId: string) {
    setBusyId(integrationId);
    const result = await disconnectPosIntegration(integrationId);
    setBusyId(null);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    setRows((prev) =>
      prev.map((row) =>
        row.id === integrationId
          ? { ...row, status: "disconnected" as const, last_error: null }
          : row
      )
    );
    toast.success("POS integration disconnected");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">POS Integrationen</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Kassensystem-Anbindung pro Standort. Bei aktiver Verbindung werden
          Bestellungen an das POS weitergeleitet.
        </p>
      </div>

      <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        {PROVIDERS.map(({ id, label }) => {
          const row = byProvider.get(id);
          const status = row?.status ?? "disconnected";
          const connected = status === "connected";

          return (
            <div
              key={id}
              className="flex flex-wrap items-start justify-between gap-4 px-6 py-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                  <Store className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-neutral-900">{label}</p>
                    {statusBadge(status)}
                  </div>
                  {row?.external_location_id && (
                    <p className="mt-1 text-sm text-neutral-500">
                      External ID: {row.external_location_id}
                    </p>
                  )}
                  {row && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Last sync: {formatSyncAt(row.last_sync_at)}
                    </p>
                  )}
                  {row?.last_error && (
                    <p className="mt-2 text-sm text-red-600">{row.last_error}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {connected && row ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => handleDisconnect(row.id)}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openConnect(id)}
                  >
                    <Plug className="mr-2 size-4" />
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect{" "}
              {PROVIDERS.find((p) => p.id === selectedProvider)?.label ??
                "POS"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="posApiKey">API Key</Label>
              <Input
                id="posApiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="POS API key"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posExternalLocationId">External Location ID</Label>
              <Input
                id="posExternalLocationId"
                value={externalLocationId}
                onChange={(e) => setExternalLocationId(e.target.value)}
                placeholder="Optional — POS location identifier"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Placeholder setup — full OAuth/sync flow follows in Track C2.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !apiKey.trim()}
              onClick={handleConnect}
            >
              {pending ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
