"use client";

import { useState, useTransition } from "react";
import { Copy, Percent } from "lucide-react";
import { toast } from "sonner";
import {
  bulkPriceUpdateAction,
  copyMenuAction,
} from "@/lib/admin/menu-sync-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LocationOption = { id: string; name: string };

export function MenuSyncPanel({ locations }: { locations: LocationOption[] }) {
  const [pending, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState(locations[0]?.id ?? "");
  const [targetId, setTargetId] = useState(locations[1]?.id ?? "");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [productMatch, setProductMatch] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [priceMode, setPriceMode] = useState<"set" | "increase_percent" | "increase_amount">(
    "increase_percent"
  );
  const [bulkLocationIds, setBulkLocationIds] = useState<string[]>(
    locations.map((l) => l.id)
  );

  function handleCopy() {
    if (!sourceId || !targetId) {
      toast.error("Select source and target locations.");
      return;
    }
    startTransition(async () => {
      const result = await copyMenuAction({
        sourceLocationId: sourceId,
        targetLocationId: targetId,
        replaceExisting,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const data = result.data!;
      toast.success(
        `Menu copied: ${data.categoriesCopied} categories, ${data.productsCopied} products.`
      );
    });
  }

  function handleBulkPrice() {
    const value = Number(priceValue);
    if (!productMatch.trim() || !Number.isFinite(value)) {
      toast.error("Enter product name and valid price value.");
      return;
    }
    startTransition(async () => {
      const result = await bulkPriceUpdateAction({
        productNameMatch: productMatch,
        locationIds: bulkLocationIds,
        mode: priceMode,
        value,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Updated ${result.data!.productsUpdated} products across ${result.data!.locationsAffected} locations.`
      );
    });
  }

  function toggleBulkLocation(id: string) {
    setBulkLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (locations.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a second location to enable menu sync between venues.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Copy className="size-5 text-amber-600" />
          <h3 className="font-semibold">Copy menu to another location</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">From</span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="block w-full rounded-md border border-border bg-card px-3 py-2"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">To</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="block w-full rounded-md border border-border bg-card px-3 py-2"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
          />
          Replace existing menu at target
        </label>
        <Button
          type="button"
          className="mt-4 gap-2"
          disabled={pending}
          onClick={handleCopy}
        >
          <Copy className="size-4" />
          Copy menu
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Percent className="size-5 text-blue-600" />
          <h3 className="font-semibold">Bulk price update (all locations)</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="productMatch">Product name contains</Label>
            <Input
              id="productMatch"
              value={productMatch}
              onChange={(e) => setProductMatch(e.target.value)}
              placeholder="e.g. Burger"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priceValue">Value</Label>
            <Input
              id="priceValue"
              type="number"
              step="0.01"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              placeholder="10 or 5 for +5%"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={priceMode}
            onChange={(e) =>
              setPriceMode(
                e.target.value as "set" | "increase_percent" | "increase_amount"
              )
            }
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="set">Set price (€)</option>
            <option value="increase_percent">Increase by %</option>
            <option value="increase_amount">Increase by €</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {locations.map((loc) => (
            <label
              key={loc.id}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                checked={bulkLocationIds.includes(loc.id)}
                onChange={() => toggleBulkLocation(loc.id)}
              />
              {loc.name}
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={pending || bulkLocationIds.length === 0}
          onClick={handleBulkPrice}
        >
          Apply bulk update
        </Button>
      </div>
    </div>
  );
}
