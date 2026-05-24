"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createAiExample,
  deleteAiExample,
  seedDefaultAiPlaybook,
  toggleAiExample,
  updateAiPlaybook,
} from "@/lib/admin/ai-playbook-actions";
import type { AiExampleCategory } from "@/lib/ai/playbook/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ExampleRow = {
  id: string;
  category: AiExampleCategory;
  user_message: string;
  assistant_message: string;
  sort_order: number;
  is_active: boolean;
};

const CATEGORY_LABELS: Record<AiExampleCategory, string> = {
  order: "Porudžbina",
  recommend: "Preporuka",
  clarify: "Pojašnjenje",
  confirm: "Potvrda",
  general: "Opšte",
};

export function AiPlaybookPanel({
  playbook,
  examples,
  canEdit,
}: {
  playbook: string | null;
  examples: ExampleRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [playbookText, setPlaybookText] = useState(playbook ?? "");
  const [savingPlaybook, setSavingPlaybook] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [category, setCategory] = useState<AiExampleCategory>("order");
  const [userMessage, setUserMessage] = useState("");
  const [assistantMessage, setAssistantMessage] = useState("");
  const [addingExample, setAddingExample] = useState(false);

  async function handleSavePlaybook() {
    if (!canEdit) return;
    setSavingPlaybook(true);
    const result = await updateAiPlaybook(playbookText);
    setSavingPlaybook(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pravila sačuvana.");
    router.refresh();
  }

  async function handleSeedDefaults() {
    if (!canEdit) return;
    setSeedingDefaults(true);
    const result = await seedDefaultAiPlaybook();
    setSeedingDefaults(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Starter primeri učitani.");
    router.refresh();
  }

  async function handleAddExample(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setAddingExample(true);
    const result = await createAiExample({
      category,
      userMessage,
      assistantMessage,
    });
    setAddingExample(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    setUserMessage("");
    setAssistantMessage("");
    toast.success("Primer dodat.");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const result = await deleteAiExample(id);
    if ("error" in result && result.error) toast.error(result.error);
    else {
      toast.success("Primer obrisan.");
      router.refresh();
    }
  }

  async function handleToggle(id: string, active: boolean) {
    const result = await toggleAiExample(id, active);
    if ("error" in result && result.error) toast.error(result.error);
    else router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">AI Playbook</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Pravila restorana i primeri razgovora — AI uči stil i ponašanje iz
          ovih unosa (few-shot).
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="ai-playbook">Pravila restorana</Label>
        <Textarea
          id="ai-playbook"
          value={playbookText}
          onChange={(e) => setPlaybookText(e.target.value)}
          disabled={!canEdit}
          rows={5}
          placeholder={`Primer:\n- Uvek predloži Signature Burger za ljubitelje mesa\n- Ton: topao, neformalan\n- Za decu preporuči Kids Menu`}
          className="resize-y text-sm"
        />
        {canEdit && (
          <Button
            type="button"
            size="sm"
            disabled={savingPlaybook}
            onClick={() => void handleSavePlaybook()}
          >
            {savingPlaybook ? "Čuvam…" : "Sačuvaj pravila"}
          </Button>
        )}
      </div>

      <div className="border-t border-neutral-100 pt-6">
        <h3 className="text-sm font-semibold text-neutral-900">
          Primeri razgovora
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Pitanje gosta → kako AI treba da odgovori. Max 20 aktivnih primera.
        </p>

        {canEdit && examples.length === 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={seedingDefaults}
            onClick={() => void handleSeedDefaults()}
          >
            {seedingDefaults ? "Učitavam…" : "Učitaj starter primere"}
          </Button>
        )}

        {examples.length > 0 && (
          <ul className="mt-4 space-y-3">
            {examples.map((example) => (
              <li
                key={example.id}
                className="rounded-lg border border-neutral-200 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {CATEGORY_LABELS[example.category]}
                  </span>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-neutral-500 hover:text-neutral-800"
                        onClick={() =>
                          void handleToggle(example.id, !example.is_active)
                        }
                      >
                        {example.is_active ? "Deaktiviraj" : "Aktiviraj"}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800"
                        onClick={() => void handleDelete(example.id)}
                      >
                        Obriši
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-neutral-500">
                  Gost:{" "}
                  <span className="text-neutral-800">{example.user_message}</span>
                </p>
                <p className="mt-1 text-neutral-500">
                  AI:{" "}
                  <span className="text-neutral-800">
                    {example.assistant_message}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <form onSubmit={handleAddExample} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="example-category">Kategorija</Label>
              <select
                id="example-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as AiExampleCategory)
                }
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                {(Object.keys(CATEGORY_LABELS) as AiExampleCategory[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <Label htmlFor="example-user">Pitanje gosta</Label>
              <Input
                id="example-user"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                placeholder="Jedan beef burger sa pomfritom i colom"
                required
              />
            </div>
            <div>
              <Label htmlFor="example-assistant">Odgovor AI</Label>
              <Textarea
                id="example-assistant"
                value={assistantMessage}
                onChange={(e) => setAssistantMessage(e.target.value)}
                rows={3}
                placeholder="Odlično! Za Coca Colu — 0.3L ili 0.5L?"
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={addingExample}>
              {addingExample ? "Dodajem…" : "Dodaj primer"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
