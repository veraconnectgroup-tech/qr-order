"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  createModifier,
  createModifierGroup,
  deleteModifier,
  deleteModifierGroup,
  updateModifier,
  updateModifierGroup,
} from "@/lib/admin/modifier-actions";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Modifier, ModifierGroup } from "@/types";

type GroupWithModifiers = ModifierGroup & { modifiers: Modifier[] };

function isDefaultModifier(modifier: Modifier, modifiers: Modifier[]) {
  if (modifiers.length === 0) return false;
  const minSort = Math.min(...modifiers.map((m) => m.sort_order));
  return modifier.sort_order === minSort;
}

function InlineEdit({
  value,
  onSave,
  className,
  type = "text",
  inputClassName,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
  className?: string;
  type?: "text" | "number";
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type={type}
        value={draft}
        disabled={saving}
        className={cn("h-8", inputClassName)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "rounded px-1 text-left hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30",
        className
      )}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </button>
  );
}

function ModifierRow({
  modifier,
  modifiers,
  currency,
  onDelete,
  onChanged,
}: {
  modifier: Modifier;
  modifiers: Modifier[];
  currency: string;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const isDefault = isDefaultModifier(modifier, modifiers);

  async function saveName(name: string) {
    const fd = new FormData();
    fd.set("name", name);
    await updateModifier(modifier.id, fd);
    onChanged();
  }

  async function savePrice(price: string) {
    const fd = new FormData();
    fd.set("price", price);
    await updateModifier(modifier.id, fd);
    onChanged();
  }

  async function toggleDefault(checked: boolean) {
    if (!checked) return;
    const fd = new FormData();
    fd.set("is_default", "true");
    await updateModifier(modifier.id, fd);
    onChanged();
  }

  return (
    <div className="flex items-center gap-3 border-t border-neutral-100 px-4 py-2">
      <InlineEdit
        value={modifier.name}
        onSave={saveName}
        className="min-w-0 flex-1 font-medium"
      />
      <InlineEdit
        value={String(Number(modifier.price))}
        onSave={savePrice}
        type="number"
        className="w-24 tabular-nums text-neutral-600"
        inputClassName="w-24"
      />
      <span className="hidden w-20 text-xs text-neutral-400 sm:inline">
        {Number(modifier.price) > 0
          ? formatPrice(Number(modifier.price), currency)
          : "Free"}
      </span>
      <div className="flex items-center gap-2">
        <Label htmlFor={`default-${modifier.id}`} className="text-xs text-neutral-500">
          Default
        </Label>
        <Switch
          id={`default-${modifier.id}`}
          checked={isDefault}
          onCheckedChange={(checked) => void toggleDefault(checked)}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Delete modifier"
      >
        <Trash2 className="size-4 text-red-500" />
      </Button>
    </div>
  );
}

function GroupCard({
  group,
  currency,
  onChanged,
}: {
  group: GroupWithModifiers;
  currency: string;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingModifier, setAddingModifier] = useState(false);
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("0");
  const [modDefault, setModDefault] = useState(false);
  const [modPending, setModPending] = useState(false);

  async function saveGroupName(name: string) {
    const fd = new FormData();
    fd.set("name", name);
    await updateModifierGroup(group.id, fd);
    onChanged();
  }

  async function saveMinSelect(value: string) {
    const fd = new FormData();
    fd.set("min_select", value);
    await updateModifierGroup(group.id, fd);
    onChanged();
  }

  async function saveMaxSelect(value: string) {
    const fd = new FormData();
    fd.set("max_select", value);
    await updateModifierGroup(group.id, fd);
    onChanged();
  }

  async function handleDeleteGroup() {
    if (!confirm(`Delete modifier group "${group.name}"?`)) return;
    await deleteModifierGroup(group.id);
    onChanged();
  }

  async function handleDeleteModifier(modifierId: string, name: string) {
    if (!confirm(`Delete modifier "${name}"?`)) return;
    await deleteModifier(modifierId);
    onChanged();
  }

  async function handleAddModifier(e: React.FormEvent) {
    e.preventDefault();
    if (!modName.trim()) return;
    setModPending(true);
    const fd = new FormData();
    fd.set("group_id", group.id);
    fd.set("name", modName.trim());
    fd.set("price", modPrice || "0");
    fd.set("is_default", modDefault ? "true" : "false");
    await createModifier(fd);
    setModPending(false);
    setModName("");
    setModPrice("0");
    setModDefault(false);
    setAddingModifier(false);
    onChanged();
  }

  const required = group.min_select > 0;
  const modifiers = useMemo(
    () =>
      [...group.modifiers]
        .filter((m) => m.is_available)
        .sort((a, b) => a.sort_order - b.sort_order),
    [group.modifiers]
  );

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse group" : "Expand group"}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !expanded && "-rotate-90")}
          />
        </button>
        <InlineEdit
          value={group.name}
          onSave={saveGroupName}
          className="font-semibold"
        />
        {required && (
          <Badge variant="secondary" className="text-xs">
            Required
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
          <span>Min</span>
          <InlineEdit
            value={String(group.min_select)}
            onSave={saveMinSelect}
            type="number"
            className="w-8 tabular-nums"
            inputClassName="w-14"
          />
          <span>Max</span>
          <InlineEdit
            value={String(group.max_select)}
            onSave={saveMaxSelect}
            type="number"
            className="w-8 tabular-nums"
            inputClassName="w-14"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleDeleteGroup()}
          aria-label="Delete group"
        >
          <Trash2 className="size-4 text-red-500" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 bg-neutral-50/50">
          {modifiers.map((modifier) => (
            <ModifierRow
              key={modifier.id}
              modifier={modifier}
              modifiers={modifiers}
              currency={currency}
              onChanged={onChanged}
              onDelete={() => void handleDeleteModifier(modifier.id, modifier.name)}
            />
          ))}

          {addingModifier ? (
            <form
              onSubmit={(e) => void handleAddModifier(e)}
              className="flex flex-wrap items-end gap-2 border-t border-neutral-100 px-4 py-3"
            >
              <div className="min-w-[140px] flex-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={modName}
                  onChange={(e) => setModName(e.target.value)}
                  className="mt-1 h-8"
                  required
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={modPrice}
                  onChange={(e) => setModPrice(e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  id={`new-default-${group.id}`}
                  checked={modDefault}
                  onCheckedChange={setModDefault}
                />
                <Label htmlFor={`new-default-${group.id}`} className="text-xs">
                  Default
                </Label>
              </div>
              <Button type="submit" size="sm" disabled={modPending}>
                {modPending ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAddingModifier(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-neutral-100 px-4 py-2 text-sm text-blue-600 hover:bg-neutral-100"
              onClick={() => setAddingModifier(true)}
            >
              <Plus className="size-4" />
              Add modifier
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ModifierGroupEditor({
  productId,
  productName,
  groups,
  currency,
}: {
  productId: string;
  productName: string;
  groups: GroupWithModifiers[];
  currency: string;
}) {
  const router = useRouter();
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [minSelect, setMinSelect] = useState("0");
  const [maxSelect, setMaxSelect] = useState("1");
  const [groupPending, setGroupPending] = useState(false);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sort_order - b.sort_order),
    [groups]
  );

  function refresh() {
    router.refresh();
  }

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setGroupPending(true);
    const fd = new FormData();
    fd.set("product_id", productId);
    fd.set("name", groupName.trim());
    fd.set("min_select", minSelect || "0");
    fd.set("max_select", maxSelect || "1");
    await createModifierGroup(fd);
    setGroupPending(false);
    setGroupName("");
    setMinSelect("0");
    setMaxSelect("1");
    setAddingGroup(false);
    refresh();
  }

  return (
    <div className="space-y-3 bg-neutral-50 px-4 py-4">
      <p className="text-sm font-medium text-neutral-700">
        Modifiers for {productName}
      </p>

      {!groups.length && !addingGroup && (
        <p className="text-sm text-neutral-500">No modifier groups yet.</p>
      )}

      {sortedGroups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          currency={currency}
          onChanged={refresh}
        />
      ))}

      {addingGroup ? (
        <form
          onSubmit={(e) => void handleAddGroup(e)}
          className="rounded-lg border border-neutral-200 bg-white p-4"
        >
          <p className="mb-3 text-sm font-medium">New modifier group</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label className="text-xs">Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1"
                placeholder="e.g. Size, Extras"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Min select</Label>
              <Input
                type="number"
                min="0"
                value={minSelect}
                onChange={(e) => setMinSelect(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Max select</Label>
              <Input
                type="number"
                min="1"
                value={maxSelect}
                onChange={(e) => setMaxSelect(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" size="sm" disabled={groupPending}>
              {groupPending ? "Saving..." : "Save group"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAddingGroup(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddingGroup(true)}
        >
          <Plus className="mr-2 size-4" />
          Add modifier group
        </Button>
      )}
    </div>
  );
}
