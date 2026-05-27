"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createUpsellRule,
  deleteUpsellRule,
  reorderUpsellRules,
  toggleUpsellRule,
  updateUpsellRule,
} from "@/lib/admin/upsell-actions";
import { formatPrice } from "@/lib/format";
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
import type { Category, Product, UpsellRule } from "@/types";

function SortableRuleRow({
  rule,
  triggerLabel,
  suggestLabel,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: UpsellRule;
  triggerLabel: string;
  suggestLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b last:border-0">
      <td className="px-2 py-3">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground/70 hover:text-muted-foreground"
          aria-label="Reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </td>
      <td className="px-4 py-3 text-foreground/90">{triggerLabel}</td>
      <td className="px-4 py-3 font-medium">{suggestLabel}</td>
      <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
        {rule.message ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span className={rule.is_active ? "text-green-600" : "text-muted-foreground/70"}>
          {rule.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {rule.is_active ? "Off" : "On"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function UpsellForm({
  rule,
  products,
  categories,
  onSubmit,
  pending,
  error,
}: {
  rule?: UpsellRule;
  products: Product[];
  categories: Category[];
  onSubmit: (formData: FormData) => Promise<void>;
  pending: boolean;
  error: string | null;
}) {
  const defaultTriggerType = rule?.trigger_product_id ? "product" : "category";

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="trigger_type">Trigger</Label>
        <select
          id="trigger_type"
          name="trigger_type"
          defaultValue={defaultTriggerType}
          className="mt-1 flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="product">Product in cart</option>
          <option value="category">Category in cart</option>
        </select>
      </div>
      <div>
        <Label htmlFor="trigger_product_id">Trigger product</Label>
        <select
          id="trigger_product_id"
          name="trigger_product_id"
          defaultValue={rule?.trigger_product_id ?? ""}
          className="mt-1 flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="trigger_category_id">Trigger category</Label>
        <select
          id="trigger_category_id"
          name="trigger_category_id"
          defaultValue={rule?.trigger_category_id ?? ""}
          className="mt-1 flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="suggest_product_id">Suggest product</Label>
        <select
          id="suggest_product_id"
          name="suggest_product_id"
          required
          defaultValue={rule?.suggest_product_id ?? ""}
          className="mt-1 flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Select product
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatPrice(Number(p.price), "EUR")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="message">Message (optional)</Label>
        <Input
          id="message"
          name="message"
          defaultValue={rule?.message ?? ""}
          placeholder="Add fries for only €2.90?"
          className="mt-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="is_active"
          name="is_active"
          type="checkbox"
          defaultChecked={rule?.is_active ?? true}
          className="size-4 rounded border-border"
        />
        <Label htmlFor="is_active">Active</Label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

export function UpsellManager({
  rules: initialRules,
  products,
  categories,
}: {
  rules: UpsellRule[];
  products: Product[];
  categories: Category[];
}) {
  const [rules, setRules] = useState(initialRules);
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<UpsellRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function triggerLabel(rule: UpsellRule) {
    if (rule.trigger_product_id) {
      return productMap.get(rule.trigger_product_id)?.name ?? "Product";
    }
    if (rule.trigger_category_id) {
      return categoryMap.get(rule.trigger_category_id)?.name ?? "Category";
    }
    return "—";
  }

  async function handleCreate(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createUpsellRule(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setCreateOpen(false);
    router.refresh();
  }

  async function handleUpdate(formData: FormData) {
    if (!editRule) return;
    setPending(true);
    setError(null);
    const result = await updateUpsellRule(editRule.id, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditRule(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this upsell rule?")) return;
    await deleteUpsellRule(id);
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rules.findIndex((r) => r.id === active.id);
    const newIndex = rules.findIndex((r) => r.id === over.id);
    const next = arrayMove(rules, oldIndex, newIndex);
    setRules(next);
    await reorderUpsellRules(next.map((r) => r.id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upsell rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cart and checkout recommendations based on cart contents
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              New rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New upsell rule</DialogTitle>
            </DialogHeader>
            <UpsellForm
              products={products}
              categories={categories}
              onSubmit={handleCreate}
              pending={pending}
              error={error}
            />
          </DialogContent>
        </Dialog>
      </div>

      {!rules.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No upsell rules yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left">
                <tr>
                  <th className="w-10 px-2 py-3" />
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">Suggestion</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <SortableContext
                items={rules.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {rules.map((rule) => (
                    <SortableRuleRow
                      key={rule.id}
                      rule={rule}
                      triggerLabel={triggerLabel(rule)}
                      suggestLabel={
                        productMap.get(rule.suggest_product_id)?.name ?? "—"
                      }
                      onEdit={() => {
                        setError(null);
                        setEditRule(rule);
                      }}
                      onDelete={() => handleDelete(rule.id)}
                      onToggle={() =>
                        toggleUpsellRule(rule.id, !rule.is_active)
                      }
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

      <Dialog open={!!editRule} onOpenChange={(open) => !open && setEditRule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit upsell rule</DialogTitle>
          </DialogHeader>
          {editRule && (
            <UpsellForm
              rule={editRule}
              products={products}
              categories={categories}
              onSubmit={handleUpdate}
              pending={pending}
              error={error}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
