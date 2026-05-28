"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Printer,
  Trash2,
  Usb,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  clearUsbPairing,
  loadUsbPairing,
  pairUsbPrinter,
} from "@/lib/printer/drivers/usb-driver";
import { invalidatePrinterSetup } from "@/lib/printer/load-printer-setup";
import { printTestTicket } from "@/lib/printer/print-kitchen-order";
import type { PrinterConfig, PrinterSetup, PrinterTarget } from "@/lib/printer/types";

const PRINT_TARGETS: PrinterTarget[] = ["kitchen", "bar", "receipt"];

type PrinterFormState = {
  name: string;
  type: "usb" | "lan" | "cloud";
  ip_address: string;
  mac_address: string;
  port: string;
  paper_width: "58" | "80";
  auto_print: boolean;
  print_for: PrinterTarget[];
};

const defaultForm = (): PrinterFormState => ({
  name: "",
  type: "lan",
  ip_address: "",
  mac_address: "",
  port: "9100",
  paper_width: "80",
  auto_print: true,
  print_for: ["kitchen"],
});

async function fetchSetup(): Promise<PrinterSetup> {
  const res = await fetch("/api/printer/configs");
  const json = (await res.json()) as { data?: PrinterSetup; error?: string };
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "Failed to load printers.");
  }
  return json.data;
}

function printForLabel(targets: PrinterTarget[]) {
  return targets
    .map((target) => target.charAt(0).toUpperCase() + target.slice(1))
    .join(", ");
}

function PrinterStatusBadge({
  printer,
}: {
  printer: PrinterConfig;
}) {
  const [usbPaired, setUsbPaired] = useState<boolean | null>(null);

  useEffect(() => {
    if (printer.type !== "usb") return;
    setUsbPaired(Boolean(loadUsbPairing(printer.id)));
  }, [printer.id, printer.type]);

  if (printer.type === "lan") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        <Wifi className="size-3" />
        {printer.ip_address}:{printer.port}
      </span>
    );
  }

  if (printer.type === "cloud") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
        <Wifi className="size-3" />
        CloudPRNT {printer.mac_address ?? "—"}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        usbPaired
          ? "bg-green-50 text-green-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <Usb className="size-3" />
      {usbPaired ? "USB paired" : "Not paired"}
    </span>
  );
}

export function PrinterSettingsPanel() {
  const [setup, setSetup] = useState<PrinterSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PrinterConfig | null>(null);
  const [form, setForm] = useState<PrinterFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSetup();
      setSetup(data);
      invalidatePrinterSetup();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load printers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openCreateDialog() {
    setEditing(null);
    setForm(defaultForm());
    setDialogOpen(true);
  }

  function openEditDialog(printer: PrinterConfig) {
    setEditing(printer);
    setForm({
      name: printer.name,
      type: printer.type,
      ip_address: printer.ip_address ?? "",
      mac_address: printer.mac_address ?? "",
      port: String(printer.port),
      paper_width: String(printer.paper_width) as "58" | "80",
      auto_print: printer.auto_print,
      print_for: [...printer.print_for],
    });
    setDialogOpen(true);
  }

  function togglePrintFor(target: PrinterTarget) {
    setForm((prev) => {
      const has = prev.print_for.includes(target);
      const next = has
        ? prev.print_for.filter((value) => value !== target)
        : [...prev.print_for, target];
      return { ...prev, print_for: next.length > 0 ? next : [target] };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Printer name is required.");
      return;
    }
    if (form.type === "lan" && !form.ip_address.trim()) {
      toast.error("IP address is required for LAN printers.");
      return;
    }
    if (form.type === "cloud" && !form.mac_address.trim()) {
      toast.error("MAC address is required for CloudPRNT printers.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        ip_address: form.type === "lan" ? form.ip_address.trim() : null,
        mac_address: form.type === "cloud" ? form.mac_address.trim() : null,
        port: Number(form.port) || 9100,
        paper_width: Number(form.paper_width),
        auto_print: form.auto_print,
        print_for: form.print_for,
      };

      const res = await fetch("/api/printer/configs", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = (await res.json()) as {
        data?: PrinterConfig;
        error?: string;
      };

      if (!res.ok || !json.data) {
        throw new Error(json.error ?? "Save failed.");
      }

      if (form.type === "usb" && !editing) {
        try {
          await pairUsbPrinter(json.data.id);
          toast.success("USB printer paired.");
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Saved, but USB pairing failed."
          );
        }
      }

      toast.success(editing ? "Printer updated." : "Printer added.");
      setDialogOpen(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(printer: PrinterConfig) {
    if (!confirm(`Delete printer "${printer.name}"?`)) return;

    setBusyId(printer.id);
    try {
      const res = await fetch(
        `/api/printer/configs?id=${encodeURIComponent(printer.id)}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Delete failed.");
      }
      clearUsbPairing(printer.id);
      toast.success("Printer deleted.");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePairUsb(printer: PrinterConfig) {
    setBusyId(printer.id);
    try {
      await pairUsbPrinter(printer.id);
      toast.success("USB printer paired.");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pairing failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTestPrint(printer: PrinterConfig) {
    if (!setup) return;
    setBusyId(printer.id);
    try {
      await printTestTicket(printer, setup);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminPanel
      className="max-w-none"
      title="Printers"
      description="ESC/POS kitchen, bar, and receipt printers for this location."
    >
      <div className="-mt-1 mb-4 flex justify-end">
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Add Printer
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading printers…
        </div>
      ) : (setup?.configs.length ?? 0) === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No printers configured. Browser print fallback remains active.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {setup?.configs.map((printer) => (
            <div
              key={printer.id}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Printer className="size-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">
                      {printer.name}
                    </h3>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-medium uppercase text-foreground/90">
                      {printer.type}
                    </span>
                    <PrinterStatusBadge printer={printer} />
                    <span className="rounded-full bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                      {printer.paper_width}mm
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Print for: {printForLabel(printer.print_for)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Auto-print: {printer.auto_print ? "On" : "Off"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === printer.id}
                  onClick={() => void handleTestPrint(printer)}
                >
                  Test Print
                </Button>
                {printer.type === "usb" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === printer.id}
                    onClick={() => void handlePairUsb(printer)}
                  >
                    Pair USB
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openEditDialog(printer)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === printer.id}
                  onClick={() => void handleDelete(printer)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Printer" : "Add Printer"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="printer-name">Name</Label>
              <Input
                id="printer-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Kitchen printer"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value: "usb" | "lan" | "cloud") =>
                  setForm((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usb">USB (WebUSB)</SelectItem>
                  <SelectItem value="lan">LAN (Network)</SelectItem>
                  <SelectItem value="cloud">CloudPRNT (Star)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === "lan" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="printer-ip">IP address</Label>
                  <Input
                    id="printer-ip"
                    value={form.ip_address}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ip_address: e.target.value,
                      }))
                    }
                    placeholder="192.168.1.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="printer-port">Port</Label>
                  <Input
                    id="printer-port"
                    value={form.port}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, port: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            {form.type === "cloud" && (
              <div className="space-y-2">
                <Label htmlFor="printer-mac">Printer MAC address</Label>
                <Input
                  id="printer-mac"
                  value={form.mac_address}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      mac_address: e.target.value,
                    }))
                  }
                  placeholder="AA:BB:CC:DD:EE:FF"
                />
                <p className="text-sm text-muted-foreground">
                  Star printer polls{" "}
                  <code className="rounded bg-muted/50 px-1">
                    /api/printer/cloudprnt
                  </code>
                  .
                </p>
              </div>
            )}

            {form.type === "usb" && !editing && (
              <p className="text-sm text-muted-foreground">
                After saving, your browser will open the USB pairing dialog.
              </p>
            )}

            <div className="space-y-2">
              <Label>Paper width</Label>
              <Select
                value={form.paper_width}
                onValueChange={(value: "58" | "80") =>
                  setForm((prev) => ({ ...prev, paper_width: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm</SelectItem>
                  <SelectItem value="80">80mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Print for</Label>
              <div className="flex flex-wrap gap-3">
                {PRINT_TARGETS.map((target) => (
                  <label
                    key={target}
                    className="flex items-center gap-2 text-sm capitalize"
                  >
                    <input
                      type="checkbox"
                      checked={form.print_for.includes(target)}
                      onChange={() => togglePrintFor(target)}
                    />
                    {target}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-print">Auto-print</Label>
              <Switch
                id="auto-print"
                checked={form.auto_print}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, auto_print: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : editing ? "Save" : "Add Printer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPanel>
  );
}
