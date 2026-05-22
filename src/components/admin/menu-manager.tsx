"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createProduct, toggleProductAvailability } from "@/lib/admin/actions";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Category, Product } from "@/types";

export function MenuManager({
  products,
  categories,
  currency,
}: {
  products: Product[];
  categories: Category[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [isAvailable, setIsAvailable] = useState(true);

  async function handleCreate(formData: FormData) {
    setPending(true);
    setError(null);
    if (categoryId) formData.set("category_id", categoryId);
    formData.set("is_available", isAvailable ? "true" : "false");
    const result = await createProduct(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setCategoryId("");
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upravljanje menijem</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Dodaj proizvod
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novi proizvod</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="name">Naziv</Label>
                <Input id="name" name="name" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="description">Opis</Label>
                <Textarea id="description" name="description" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="price">Cena ({currency})</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Kategorija</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Izaberi kategoriju" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prep_time_minutes">Vreme pripreme (min)</Label>
                <Input
                  id="prep_time_minutes"
                  name="prep_time_minutes"
                  type="number"
                  min="1"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_available"
                  checked={isAvailable}
                  onCheckedChange={setIsAvailable}
                />
                <Label htmlFor="is_available">Dostupan</Label>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Čuvanje..." : "Sačuvaj proizvod"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!products.length ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-neutral-600">Meni je prazan.</p>
          <p className="mt-1 text-sm text-neutral-400">
            Dodaj prvi proizvod da gosti mogu da naručuju.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Naziv</th>
                <th className="px-4 py-3 font-medium">Cena</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{product.name}</p>
                    {product.description && (
                      <p className="line-clamp-1 text-neutral-500">
                        {product.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatPrice(Number(product.price), currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={product.is_available ? "default" : "secondary"}>
                      {product.is_available ? "Uključen" : "Isključen"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleProductAvailability(
                          product.id,
                          !product.is_available
                        )
                      }
                    >
                      {product.is_available ? "Isključi" : "Uključi"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
