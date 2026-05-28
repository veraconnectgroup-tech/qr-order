"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Printer, QrCode } from "lucide-react";
import { QrTableCardPreview } from "@/components/design-system";
import { createTable, createZone, assignTableStaff } from "@/lib/admin/actions";
import { useAppBaseUrl } from "@/hooks/use-app-base-url";
import { guestTableUrl } from "@/lib/app-url";
import {
  buildQrTableCardPrintHtml,
  generateTableQrDataUrl,
  openQrTableCardPrintWindow,
  prepareQrTableCardItems,
  resolveQrTableCardLocale,
} from "@/lib/print/qr-table-card-print";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Staff, Table, Zone } from "@/types";

function QrPreview({
  table,
  orgSlug,
  orgName,
  zoneName,
  menuLocale,
}: {
  table: Table;
  orgSlug: string;
  orgName: string;
  zoneName?: string | null;
  menuLocale?: string | null;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const appUrl = useAppBaseUrl();
  const scanUrl = guestTableUrl(orgSlug, table.qr_token, appUrl);
  const cardLocale = resolveQrTableCardLocale(menuLocale);

  useEffect(() => {
    generateTableQrDataUrl(scanUrl, 280).then(setQrUrl);
  }, [scanUrl]);

  async function downloadPng() {
    const dataUrl = await generateTableQrDataUrl(scanUrl, 840);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${table.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  async function printCard() {
    const [item] = await prepareQrTableCardItems([
      {
        tableName: table.name,
        zoneName,
        scanUrl,
      },
    ]);
    const html = buildQrTableCardPrintHtml({
      venueName: orgName,
      items: [item],
      locale: cardLocale,
      autoPrint: true,
    });
    openQrTableCardPrintWindow(html);
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Table ordering — {table.name}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-4 py-4">
        <QrTableCardPreview
          venueName={orgName}
          tableName={table.name}
          zoneName={zoneName}
          qrDataUrl={qrUrl}
          locale={menuLocale}
          className="w-full max-w-xs"
        />
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button onClick={printCard} disabled={!qrUrl} className="flex-1">
            <Printer className="mr-2 size-4" />
            Print card
          </Button>
          <Button
            onClick={downloadPng}
            disabled={!qrUrl}
            variant="outline"
            className="flex-1"
          >
            <Download className="mr-2 size-4" />
            Download PNG
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export function TablesManager({
  tables,
  zones,
  staffMembers,
  orgSlug,
  orgName,
  menuLocale,
}: {
  tables: Table[];
  zones: Zone[];
  staffMembers: Pick<Staff, "id" | "name">[];
  orgSlug: string;
  orgName: string;
  menuLocale?: string | null;
}) {
  const [tableOpen, setTableOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [zoneId, setZoneId] = useState("");

  const grouped = zones.map((zone) => ({
    zone,
    tables: tables.filter((t) => t.zone_id === zone.id),
  }));

  const ungrouped = tables.filter((t) => !t.zone_id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tables</h1>
        <div className="flex gap-2">
          <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 size-4" />
                Zone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New zone</DialogTitle>
              </DialogHeader>
              <form
                action={async (fd) => {
                  await createZone(fd);
                  setZoneOpen(false);
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="zone-name">Zone name</Label>
                  <Input id="zone-name" name="name" required className="mt-1" />
                </div>
                <Button type="submit" className="w-full">
                  Save
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={tableOpen} onOpenChange={setTableOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" />
                Add table
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New table</DialogTitle>
              </DialogHeader>
              <form
                action={async (fd) => {
                  if (zoneId) fd.set("zone_id", zoneId);
                  await createTable(fd);
                  setTableOpen(false);
                  setZoneId("");
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="table-name">Name</Label>
                  <Input id="table-name" name="name" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="seats">Seats</Label>
                  <Input
                    id="seats"
                    name="seats"
                    type="number"
                    defaultValue={4}
                    min={1}
                    className="mt-1"
                  />
                </div>
                {zones.length > 0 && (
                  <div>
                    <Label>Zone</Label>
                    <Select value={zoneId} onValueChange={setZoneId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((z) => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full">
                  Save
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!qrTable} onOpenChange={(o) => !o && setQrTable(null)}>
        {qrTable && (
          <QrPreview
            table={qrTable}
            orgSlug={orgSlug}
            orgName={orgName}
            zoneName={zones.find((zone) => zone.id === qrTable.zone_id)?.name}
            menuLocale={menuLocale}
          />
        )}
      </Dialog>

      {!tables.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No tables yet.</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Add zones and tables, then generate QR codes.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ zone, tables: zoneTables }) => (
            <section key={zone.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {zone.name} ({zoneTables.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {zoneTables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    staffMembers={staffMembers}
                    onShowQr={() => setQrTable(table)}
                  />
                ))}
              </div>
            </section>
          ))}
          {ungrouped.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Unzoned
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ungrouped.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    staffMembers={staffMembers}
                    onShowQr={() => setQrTable(table)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TableCard({
  table,
  staffMembers,
  onShowQr,
}: {
  table: Table;
  staffMembers: Pick<Staff, "id" | "name">[];
  onShowQr: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-semibold">{table.name}</p>
      <p className="text-sm text-muted-foreground">{table.seats} seats</p>
      {staffMembers.length > 0 && (
        <div className="mt-2">
          <Label className="text-xs text-muted-foreground">Waiter (tips)</Label>
          <Select
            value={table.assigned_staff_id ?? "none"}
            onValueChange={async (v) => {
              await assignTableStaff(
                table.id,
                v === "none" ? null : v
              );
            }}
          >
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {staffMembers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={onShowQr}>
          <QrCode className="mr-1 size-4" />
          QR
        </Button>
      </div>
    </div>
  );
}
