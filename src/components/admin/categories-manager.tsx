"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory } from "@/lib/admin/actions";
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
import { Textarea } from "@/components/ui/textarea";
import type { Category } from "@/types";

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCreate(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createCategory(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Obrisati kategoriju?")) return;
    await deleteCategory(id);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kategorije</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Dodaj kategoriju
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova kategorija</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="name">Naziv</Label>
                <Input id="name" name="name" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="name_en">Naziv (EN)</Label>
                <Input id="name_en" name="name_en" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="description">Opis</Label>
                <Textarea id="description" name="description" className="mt-1" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Čuvanje..." : "Sačuvaj"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!categories.length ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-neutral-600">Još nema kategorija.</p>
          <p className="mt-1 text-sm text-neutral-400">
            Dodaj prvu kategoriju da bi organizovao meni.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Naziv</th>
                <th className="px-4 py-3 font-medium">Redosled</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{cat.sort_order}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        cat.is_active
                          ? "text-green-600"
                          : "text-neutral-400"
                      }
                    >
                      {cat.is_active ? "Aktivna" : "Neaktivna"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cat.id)}
                      aria-label="Obriši"
                    >
                      <Trash2 className="size-4 text-red-500" />
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
