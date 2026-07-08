"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  QrCard,
  QrCardDescription,
  QrCardTitle,
} from "@/components/design-system/qr-card";

type KnowledgeEntry = {
  id: string;
  text: string;
  source: "admin_text" | "owner_voice";
  createdAt: string;
};

/**
 * Owner/manager-facing manager for durable "house knowledge" — facts and
 * rules Denis should always have (e.g. "we don't do substitutions on the
 * tasting menu"), distinct from the auto-learned venue knowledge panel
 * above this one. Reaches every guest-turn prompt once saved (see
 * restaurant-knowledge-store.ts).
 */
export function DenisRestaurantKnowledgePanel() {
  const [entries, setEntries] = useState<KnowledgeEntry[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/denis-restaurant-knowledge");
      const json = await res.json();
      if (res.ok) setEntries(json.data.entries);
    } catch {
      setError("Nije moguće učitati.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/denis-restaurant-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Nije sačuvano.");
        return;
      }
      setDraft("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setEntries((prev) => (prev ? prev.filter((entry) => entry.id !== id) : prev));
    await fetch(`/api/admin/denis-restaurant-knowledge/${id}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  return (
    <QrCard>
      <QrCardTitle>Šta Denis treba uvek da zna</QrCardTitle>
      <QrCardDescription>
        Pravila, činjenice, stil rada — kratke rečenice koje Denis uvek nosi
        sa sobom u razgovoru, sa gostima i osobljem. Ne ponaša se kao
        napomena za jedan sto — ovo je trajno, dok ga ne obrišeš.
      </QrCardDescription>

      <div className="mt-4 space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder='npr. "Ne radimo zamene u degustacionom meniju." ili "Vlasnik se zove Marko, ovde je svaki dan."'
          maxLength={500}
          rows={2}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleAdd}
            disabled={saving || !draft.trim()}
          >
            Dodaj
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {entries === null && (
          <p className="text-sm text-muted-foreground">Učitavanje...</p>
        )}
        {entries?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Denis još ne zna ništa posebno o ovom restoranu — dodaj prvo
            pravilo iznad.
          </p>
        )}
        {entries?.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between gap-3 rounded border border-border p-2 text-sm"
          >
            <span>
              {entry.text}
              {entry.source === "owner_voice" && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (rečeno glasom)
                </span>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(entry.id)}
            >
              Obriši
            </Button>
          </div>
        ))}
      </div>
    </QrCard>
  );
}
