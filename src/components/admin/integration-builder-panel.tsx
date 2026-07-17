"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  analyzeIntegrationDocument,
  generateAdapterDraft,
} from "@/lib/denis/integrations/analyze-integration-document";
import type {
  CapabilityManifest,
  CapabilityRecord,
  DenisCapability,
} from "@/lib/denis/integrations/capabilities/denis-capability-types";
import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_LABELS: Record<CapabilityRecord["status"], string> = {
  supported: "Podržano",
  supported_with_limitations: "Podržano sa ograničenjima",
  unsupported: "Nije podržano",
  requires_direct_integration: "Zahteva direktnu integraciju",
  requires_human_operation: "Zahteva ljudsku akciju",
  unknown: "Nepoznato",
  experimental: "Eksperimentalno",
};

const STATUS_COLORS: Record<CapabilityRecord["status"], string> = {
  supported: "bg-green-50 text-green-700",
  supported_with_limitations: "bg-amber-50 text-amber-700",
  unsupported: "bg-muted/50 text-muted-foreground",
  requires_direct_integration: "bg-muted/50 text-muted-foreground",
  requires_human_operation: "bg-muted/50 text-muted-foreground",
  unknown: "bg-muted/50 text-muted-foreground",
  experimental: "bg-blue-50 text-blue-700",
};

type Step = "input" | "review" | "generated";

export function IntegrationBuilderPanel() {
  const [step, setStep] = useState<Step>("input");
  const [providerName, setProviderName] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [spec, setSpec] = useState<ParsedApiSpec | null>(null);
  const [manifest, setManifest] = useState<CapabilityManifest | null>(null);
  const [selected, setSelected] = useState<Set<DenisCapability>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  async function handleAnalyze() {
    if (!providerName.trim() || !rawContent.trim()) return;
    setAnalyzing(true);
    try {
      const result = await analyzeIntegrationDocument({
        providerName,
        rawContent,
      });
      if (!result.ok) {
        toast.error("Analiza nije uspela: " + result.error);
        return;
      }
      setSpec(result.spec);
      setManifest(result.manifest);
      setSelected(
        new Set(
          result.manifest.records
            .filter((r) => r.status === "supported")
            .map((r) => r.capability)
        )
      );
      setStep("review");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Analiza nije uspela."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleCapability(capability: DenisCapability) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(capability)) next.delete(capability);
      else next.add(capability);
      return next;
    });
  }

  async function handleGenerate() {
    if (!spec || !manifest || selected.size === 0) return;
    setGenerating(true);
    try {
      const result = await generateAdapterDraft({
        spec,
        manifest,
        selectedCapabilities: Array.from(selected),
      });
      if (!result.ok) {
        toast.error("Generisanje nije uspelo: " + result.error);
        return;
      }
      setGeneratedCode(result.code);
      setStep("generated");
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setStep("input");
    setProviderName("");
    setRawContent("");
    setSpec(null);
    setManifest(null);
    setSelected(new Set());
    setGeneratedCode("");
  }

  if (step === "input") {
    return (
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label>Naziv provajdera</Label>
          <Input
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="npr. Acme POS"
          />
        </div>
        <div className="space-y-1">
          <Label>OpenAPI ili Postman dokument (JSON)</Label>
          <Textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            placeholder="Nalepi ceo OpenAPI 3.x/Swagger 2.x JSON ili Postman Collection v2.1 JSON ovde…"
            rows={14}
            className="font-mono text-xs"
          />
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || !providerName.trim() || !rawContent.trim()}
        >
          {analyzing ? "Analiziram…" : "Analiziraj"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Deterministički parser čita OpenAPI/Postman strukturu; LLM se
          konsultuje SAMO za endpointe koje parser ne može pouzdano da
          prepozna, i to nikad ne postaje &quot;podržano&quot; bez citata iz
          same dokumentacije.
        </p>
      </div>
    );
  }

  if (step === "review" && manifest) {
    return (
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Capability izveštaj — {manifest.provider}
          </h2>
          <Button variant="ghost" size="sm" onClick={reset}>
            Počni ispočetka
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Čekiraj koje sposobnosti želiš da se generišu. Generiše se SAMO ono
          što je ovde označeno — ništa se ne piše u pravi kod bez tvog
          odobrenja u sledećem koraku.
        </p>
        <div className="space-y-2">
          {manifest.records.map((record) => (
            <div
              key={record.capability}
              className="flex items-start gap-3 rounded-md border px-3 py-2"
            >
              {record.status === "supported" ? (
                <Checkbox
                  checked={selected.has(record.capability)}
                  onCheckedChange={() => toggleCapability(record.capability)}
                  className="mt-0.5"
                />
              ) : (
                <div className="mt-0.5 size-4" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">
                    {record.capability}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[record.status]}`}
                  >
                    {STATUS_LABELS[record.status]}
                  </span>
                </div>
                {record.endpoint && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {record.endpoint}
                  </p>
                )}
                {record.quotedSpan && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    &quot;{record.quotedSpan}&quot;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || selected.size === 0}
        >
          {generating
            ? "Generišem…"
            : `Generiši nacrt adaptera (${selected.size})`}
        </Button>
      </div>
    );
  }

  if (step === "generated") {
    return (
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Generisani nacrt — {manifest?.provider}
          </h2>
          <Button variant="ghost" size="sm" onClick={reset}>
            Počni ispočetka
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ovo je nacrt, ne pravi kod. Niko od ovoga nije aktivirano — pregled
          i ručno spajanje u src/lib/pos/adapters/ ostaje ljudski korak
          (ADR-052 §C koraci 13-14), namerno, ne automatski.
        </p>
        <pre className="max-h-[500px] overflow-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">
          <code>{generatedCode}</code>
        </pre>
      </div>
    );
  }

  return null;
}
