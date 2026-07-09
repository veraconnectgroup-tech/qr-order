"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Proposal = {
  toolCallId: string;
  proposal: Record<string, unknown>;
  status: "pending" | "applying" | "applied" | "error" | "discarded";
  errorMessage?: string;
};

const EXAMPLE_PROMPTS = [
  "Dodaj novo piće od 320 din u meni",
  "Koje su mi cene najniže u odnosu na kategoriju?",
  "Napiši bolji opis za [ime stavke]",
  "Podigni sve cene u kategoriji Pića za 10%",
];

function proposalTitle(proposal: Record<string, unknown>): string {
  if (proposal.type === "add_product") return `Novi proizvod: ${proposal.name}`;
  if (proposal.type === "update_price") return "Promena cene";
  if (proposal.type === "update_description") return "Novi opis";
  return "Predlog";
}

function proposalDetail(proposal: Record<string, unknown>): string {
  if (proposal.type === "add_product") {
    return `${proposal.price} din${proposal.description ? ` — ${proposal.description}` : ""}`;
  }
  if (proposal.type === "update_price") {
    return `Nova cena: ${proposal.newPrice} din`;
  }
  if (proposal.type === "update_description") {
    return String(proposal.newDescription);
  }
  return JSON.stringify(proposal);
}

export function DenisMenuAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposalsByMessage, setProposalsByMessage] = useState<
    Record<number, Proposal[]>
  >({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const nextMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(nextMessages);
    setDraft("");

    try {
      const res = await fetch("/api/admin/denis-menu-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Greška.");
        return;
      }

      const assistantIndex = nextMessages.length;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.data.message ?? "(predlog ispod)",
        },
      ]);

      const proposals: Proposal[] = (json.data.proposals ?? []).map(
        (p: { toolCallId: string; proposal: Record<string, unknown> }) => ({
          ...p,
          status: "pending" as const,
        })
      );
      if (proposals.length > 0) {
        setProposalsByMessage((prev) => ({ ...prev, [assistantIndex]: proposals }));
      }
    } catch {
      setError("Nije moguće poslati poruku.");
    } finally {
      setSending(false);
    }
  }

  async function applyProposal(messageIndex: number, toolCallId: string) {
    const list = proposalsByMessage[messageIndex] ?? [];
    const target = list.find((p) => p.toolCallId === toolCallId);
    if (!target) return;

    setProposalsByMessage((prev) => ({
      ...prev,
      [messageIndex]: prev[messageIndex].map((p) =>
        p.toolCallId === toolCallId ? { ...p, status: "applying" } : p
      ),
    }));

    try {
      const res = await fetch("/api/admin/denis-menu-agent/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: target.proposal }),
      });
      const json = await res.json();

      setProposalsByMessage((prev) => ({
        ...prev,
        [messageIndex]: prev[messageIndex].map((p) =>
          p.toolCallId === toolCallId
            ? res.ok
              ? { ...p, status: "applied" }
              : { ...p, status: "error", errorMessage: json?.error }
            : p
        ),
      }));
    } catch {
      setProposalsByMessage((prev) => ({
        ...prev,
        [messageIndex]: prev[messageIndex].map((p) =>
          p.toolCallId === toolCallId
            ? { ...p, status: "error", errorMessage: "Mrežna greška." }
            : p
        ),
      }));
    }
  }

  function discardProposal(messageIndex: number, toolCallId: string) {
    setProposalsByMessage((prev) => ({
      ...prev,
      [messageIndex]: prev[messageIndex].map((p) =>
        p.toolCallId === toolCallId ? { ...p, status: "discarded" } : p
      ),
    }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Denis — meni asistent
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Razgovaraj sa Denisom o meniju. Ništa se ne menja dok ne klikneš
          Primeni na konkretan predlog.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              className="rounded border border-border p-3 text-left text-sm hover:bg-muted"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className="space-y-2">
            <div
              className={
                msg.role === "user"
                  ? "ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              {msg.content}
            </div>
            {proposalsByMessage[index]?.map((p) => (
              <div
                key={p.toolCallId}
                className="rounded border border-border p-3 text-sm"
              >
                <p className="font-medium">{proposalTitle(p.proposal)}</p>
                <p className="text-muted-foreground">{proposalDetail(p.proposal)}</p>
                {p.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void applyProposal(index, p.toolCallId)}
                    >
                      Primeni
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => discardProposal(index, p.toolCallId)}
                    >
                      Odbaci
                    </Button>
                  </div>
                )}
                {p.status === "applying" && (
                  <p className="mt-2 text-xs text-muted-foreground">Primenjujem...</p>
                )}
                {p.status === "applied" && (
                  <p className="mt-2 text-xs text-green-600">Primenjeno.</p>
                )}
                {p.status === "discarded" && (
                  <p className="mt-2 text-xs text-muted-foreground">Odbačeno.</p>
                )}
                {p.status === "error" && (
                  <p className="mt-2 text-xs text-destructive">
                    Greška: {p.errorMessage ?? "nepoznata"}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Pitaj Denisa o meniju ili mu reci šta da doda/promeni..."
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(draft);
            }
          }}
        />
        <Button
          type="button"
          onClick={() => void sendMessage(draft)}
          disabled={sending || !draft.trim()}
        >
          Pošalji
        </Button>
      </div>
    </div>
  );
}
