"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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

type PendingProposal = {
  id: string;
  text: string;
  proposedByStaffId: string | null;
  sourceAiSessionId: string | null;
  createdAt: string;
  pendingExpiresAt: string | null;
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
  const [pending, setPending] = useState<PendingProposal[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/denis-restaurant-knowledge");
      const json = await res.json();
      if (res.ok) setEntries(json.data.entries);
    } catch {
      setError("Nije moguće učitati.");
    }
  }

  async function loadPending() {
    try {
      const res = await fetch("/api/admin/denis-restaurant-knowledge/pending");
      const json = await res.json();
      if (res.ok) setPending(json.data.proposals);
    } catch {
      // Pending confirmations are a secondary section — fail quietly.
    }
  }

  useEffect(() => {
    void load();
    void loadPending();
  }, []);

  async function handleDecide(id: string, decision: "confirm" | "reject") {
    setDecidingId(id);
    try {
      const res = await fetch(
        `/api/admin/denis-restaurant-knowledge/${id}/${decision}`,
        { method: "POST" }
      );
      if (res.ok) {
        setPending((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
        if (decision === "confirm") await load();
      }
    } finally {
      setDecidingId(null);
    }
  }

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
    const removed = entries?.find((entry) => entry.id === id) ?? null;
    setEntries((prev) => (prev ? prev.filter((entry) => entry.id !== id) : prev));
    try {
      const res = await fetch(`/api/admin/denis-restaurant-knowledge/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      toast.error(
        "Brisanje nije uspelo — pravilo je i dalje aktivno kod Denisa."
      );
      if (removed) {
        setEntries((prev) =>
          prev
            ? prev.some((entry) => entry.id === id)
              ? prev
              : [...prev, removed].sort((a, b) =>
                  a.createdAt.localeCompare(b.createdAt)
                )
            : prev
        );
      }
    }
  }

  return (
    <QrCard>
      <QrCardTitle>Šta Denis treba uvek da zna</QrCardTitle>
      <QrCardDescription>
        Pravila, činjenice, stil rada — kratke rečenice koje Denis uvek nosi
        sa sobom u razgovoru, sa gostima i osobljem. Ne ponaša se kao
        napomena za jedan sto — ovo je trajno, dok ga ne obrišeš.
      </QrCardDescription>

      {pending && pending.length > 0 && (
        <div className="mt-4 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Čeka tvoju potvrdu ({pending.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Denis je ovo čuo od kolege i predlaže da postane trajno pravilo —
            ništa se ne menja dok ne potvrdiš.
          </p>
          {pending.map((proposal) => (
            <div
              key={proposal.id}
              className="flex items-start justify-between gap-3 rounded border border-amber-200 bg-background p-2 text-sm dark:border-amber-900"
            >
              <span>{proposal.text}</span>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={decidingId === proposal.id}
                  onClick={() => handleDecide(proposal.id, "confirm")}
                >
                  Potvrdi
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={decidingId === proposal.id}
                  onClick={() => handleDecide(proposal.id, "reject")}
                >
                  Odbaci
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
