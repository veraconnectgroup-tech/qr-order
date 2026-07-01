"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, FlaskConical, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import {
  importDenisConfigEditorAction,
  resetDenisConfigEditorLocationAction,
  saveDenisConfigEditorPatchAction,
  type DenisConfigEditorSnapshot,
} from "@/lib/admin/denis-config-editor-actions";
import { buildConciergeConfigPreview } from "@/lib/denis/config/concierge-config-preview";
import { exportConciergeConfig } from "@/lib/denis/config/concierge-config-io";
import { resolveConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import type {
  ConciergeConfig,
  ConciergeGreetingStyle,
  ConciergeTone,
  PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import {
  buildToneAbExperiment,
  compareToneUpsellRates,
} from "@/lib/denis/eval/tone-ab-comparison";
import type { DenisPlaybookEditorSnapshot } from "@/lib/admin/denis-playbook-actions";
import { DenisPlaybookPanel } from "@/components/admin/denis-playbook-panel";
import { AdminPanel, AdminPanelSection } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TONE_OPTIONS: { value: ConciergeTone; label: string }[] = [
  { value: "warm_short", label: "Topao i kratak" },
  { value: "formal", label: "Formalno" },
  { value: "playful_luxury", label: "Luksuzno / playful" },
  { value: "efficient", label: "Efikasno" },
];

const GREETING_OPTIONS: { value: ConciergeGreetingStyle; label: string }[] = [
  { value: "offer_drink_or_food", label: "Ponudi piće ili hranu" },
  { value: "welcome_only", label: "Samo dobrodošlica" },
  { value: "venue_story", label: "Priča o lokalu" },
];

type DraftState = PartialConciergeConfig;

function effectiveDraftConfig(
  snapshot: DenisConfigEditorSnapshot,
  draft: DraftState
): ConciergeConfig {
  const locationPatch: PartialConciergeConfig = {
    ...snapshot.locationOverride,
    ...draft,
    persona: {
      ...snapshot.effectiveConfig.persona,
      ...snapshot.locationOverride.persona,
      ...draft.persona,
    },
    language: {
      ...snapshot.effectiveConfig.language,
      ...snapshot.locationOverride.language,
      ...draft.language,
    },
    ordering: {
      ...snapshot.effectiveConfig.ordering,
      ...snapshot.locationOverride.ordering,
      ...draft.ordering,
    },
    upsell: {
      ...snapshot.effectiveConfig.upsell,
      ...snapshot.locationOverride.upsell,
      ...draft.upsell,
    },
    proactive: {
      ...snapshot.effectiveConfig.proactive,
      ...snapshot.locationOverride.proactive,
      ...draft.proactive,
    },
  };

  return resolveConciergeConfig({
    orgConfig: snapshot.orgOverride,
    locationConfig: locationPatch,
  });
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PreviewPanel({ config }: { config: ConciergeConfig }) {
  const preview = useMemo(
    () => buildConciergeConfigPreview(config),
    [config]
  );

  return (
    <AdminPanel
      className="max-w-none sticky top-4"
      title={preview.headline}
      description="Live preview — menja se odmah kad promenite ton ili stil."
    >
      <div className="mt-4 space-y-3">
        {preview.transcript.map((line, index) => (
          <div
            key={`${line.role}-${index}`}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              line.role === "assistant"
                ? "bg-dash-accent/10 text-foreground"
                : "ml-6 bg-muted/40 text-muted-foreground"
            )}
          >
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {line.role === "assistant" ? config.persona.name : "Gost"}
            </span>
            {line.text}
          </div>
        ))}
      </div>
    </AdminPanel>
  );
}

export function DenisConfigEditor({
  initialSnapshot,
  playbookSnapshot,
}: {
  initialSnapshot: DenisConfigEditorSnapshot;
  playbookSnapshot?: DenisPlaybookEditorSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [draft, setDraft] = useState<DraftState>({});
  const [importText, setImportText] = useState("");
  const [abToneA, setAbToneA] = useState<ConciergeTone>("formal");
  const [abToneB, setAbToneB] = useState<ConciergeTone>("playful_luxury");
  const [pending, startTransition] = useTransition();

  const effective = useMemo(
    () => effectiveDraftConfig(snapshot, draft),
    [snapshot, draft]
  );

  const hasLocationOverride = Object.keys(snapshot.locationOverride).length > 0;

  const abPreview = useMemo(() => {
    const experiment = buildToneAbExperiment({
      toneA: abToneA,
      toneB: abToneB,
      trafficSplit: 0.5,
      minSessions: 100,
    });
    const sessionsA = Array.from({ length: 120 }, (_, i) => ({
      sessionToken: `a-${i}`,
      converted: i % 3 === 0,
      orderValueCents: i % 3 === 0 ? 3200 : 0,
      upsellAccepted: i % 4 === 0,
      minutesToFirstOrder: 10,
    }));
    const sessionsB = Array.from({ length: 118 }, (_, i) => ({
      sessionToken: `b-${i}`,
      converted: i % 3 === 0,
      orderValueCents: i % 3 === 0 ? 3400 : 0,
      upsellAccepted: i % 3 === 1,
      minutesToFirstOrder: 9,
    }));
    return compareToneUpsellRates({ experiment, sessionsA, sessionsB });
  }, [abToneA, abToneB]);

  function updateDraft(patch: DraftState) {
    setDraft((prev) => ({
      ...prev,
      ...patch,
      persona: { ...prev.persona, ...patch.persona },
      language: { ...prev.language, ...patch.language },
      ordering: { ...prev.ordering, ...patch.ordering },
      upsell: { ...prev.upsell, ...patch.upsell },
      proactive: { ...prev.proactive, ...patch.proactive },
    }));
  }

  function onSave() {
    if (!Object.keys(draft).length) {
      toast.message("Nema izmena za čuvanje.");
      return;
    }

    startTransition(async () => {
      const result = await saveDenisConfigEditorPatchAction({
        locationId: snapshot.locationId,
        patch: draft,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Konfiguracija sačuvana.");
      setDraft({});
      setSnapshot((prev) => {
        const locationOverride = mergePartialConciergeConfig(
          prev.locationOverride,
          draft
        );
        return {
          ...prev,
          locationOverride,
          effectiveConfig: resolveConciergeConfig({
            orgConfig: prev.orgOverride,
            locationConfig: locationOverride,
          }),
        };
      });
    });
  }

  function onExport() {
    const json = exportConciergeConfig({
      ...snapshot.locationOverride,
      ...draft,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `denis-config-${snapshot.locationName.replace(/\s+/g, "-").toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("JSON izvezen.");
  }

  function onImport() {
    startTransition(async () => {
      const result = await importDenisConfigEditorAction({
        locationId: snapshot.locationId,
        json: importText,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Konfiguracija uvezena.");
      setImportText("");
      setDraft({});
      window.location.reload();
    });
  }

  function onResetLocation() {
    startTransition(async () => {
      const result = await resetDenisConfigEditorLocationAction(snapshot.locationId);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Lokalni override uklonjen — koriste se org/platform podrazumevane vrednosti.");
      window.location.reload();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Denis konfiguracija
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Podesite kako Denis priča, naručuje i prodaje — bez koda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {snapshot.canEdit && (
              <Button type="button" onClick={onSave} disabled={pending}>
                <Save className="mr-2 size-4" />
                Sačuvaj
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onExport}>
              <Download className="mr-2 size-4" />
              Export JSON
            </Button>
          </div>
        </div>

        <AdminPanelSection className="flex flex-wrap items-center gap-4">
          <FieldRow label="Lokacija">
            <Select
              value={snapshot.locationId}
              onValueChange={(value) => {
                window.location.href = `/admin/denis?locationId=${value}`;
              }}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {snapshot.accessibleLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <div className="text-xs text-muted-foreground">
            {hasLocationOverride
              ? "Ova lokacija ima svoj override (npr. HQ formalno, beach bar playful)."
              : "Koriste se org + platform podrazumevane vrednosti."}
          </div>
          {snapshot.canEdit && hasLocationOverride && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onResetLocation}
              disabled={pending}
            >
              <RotateCcw className="mr-1 size-3.5" />
              Ukloni lokalni override
            </Button>
          )}
        </AdminPanelSection>

        <Tabs defaultValue="persona">
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="persona">Persona</TabsTrigger>
            <TabsTrigger value="language">Jezik</TabsTrigger>
            <TabsTrigger value="ordering">Naručivanje</TabsTrigger>
            <TabsTrigger value="upsell">Upsell</TabsTrigger>
            <TabsTrigger value="proactive">Proaktivno</TabsTrigger>
            <TabsTrigger value="playbook">Playbook</TabsTrigger>
            <TabsTrigger value="ab">A/B ton</TabsTrigger>
            <TabsTrigger value="io">Import / Export</TabsTrigger>
          </TabsList>

          <TabsContent value="persona" className="mt-4 space-y-4">
            <AdminPanel title="Persona" className="max-w-none">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Ime">
                  <Input
                    value={effective.persona.name}
                    onChange={(e) =>
                      updateDraft({ persona: { name: e.target.value } })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Ton">
                  <Select
                    value={effective.persona.tone}
                    onValueChange={(value) =>
                      updateDraft({
                        persona: { tone: value as ConciergeTone },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Stil pozdrava">
                  <Select
                    value={effective.persona.greetingStyle}
                    onValueChange={(value) =>
                      updateDraft({
                        persona: {
                          greetingStyle: value as ConciergeGreetingStyle,
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GREETING_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Max reči po odgovoru">
                  <Input
                    type="number"
                    min={10}
                    max={200}
                    value={effective.persona.maxWordsPerReply}
                    onChange={(e) =>
                      updateDraft({
                        persona: {
                          maxWordsPerReply: Number.parseInt(e.target.value, 10),
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Emoji u odgovorima">
                  <div className="flex h-10 items-center">
                    <Switch
                      checked={effective.persona.emoji}
                      onCheckedChange={(checked) =>
                        updateDraft({ persona: { emoji: checked } })
                      }
                      disabled={!snapshot.canEdit}
                    />
                  </div>
                </FieldRow>
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="language" className="mt-4">
            <AdminPanel title="Jezik" className="max-w-none">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Podrazumevani jezik lokacije">
                  <Input
                    value={effective.language.venueDefault}
                    onChange={(e) =>
                      updateDraft({
                        language: { venueDefault: e.target.value },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Prati jezik gosta">
                  <div className="flex h-10 items-center">
                    <Switch
                      checked={effective.language.followGuest}
                      onCheckedChange={(checked) =>
                        updateDraft({ language: { followGuest: checked } })
                      }
                      disabled={!snapshot.canEdit}
                    />
                  </div>
                </FieldRow>
                <FieldRow label="Fallback kad jezik nije poznat">
                  <Select
                    value={effective.language.fallbackWhenUnknown}
                    onValueChange={(value) =>
                      updateDraft({
                        language: {
                          fallbackWhenUnknown: value as "venue" | "english",
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venue">Jezik lokacije</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="ordering" className="mt-4">
            <AdminPanel title="Naručivanje" className="max-w-none">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Flow">
                  <Select
                    value={effective.ordering.flow}
                    onValueChange={(value) =>
                      updateDraft({
                        ordering: {
                          flow: value as "denis_short" | "classic_chatty",
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="denis_short">Kratak (Denis)</SelectItem>
                      <SelectItem value="classic_chatty">Razgovorljiv</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Eksplicitna potvrda pre slanja">
                  <div className="flex h-10 items-center">
                    <Switch
                      checked={effective.ordering.requireExplicitConfirm}
                      onCheckedChange={(checked) =>
                        updateDraft({
                          ordering: { requireExplicitConfirm: checked },
                        })
                      }
                      disabled={!snapshot.canEdit}
                    />
                  </div>
                </FieldRow>
                <FieldRow label="Max stavki po porudžbini">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={effective.ordering.maxItemsPerOrder}
                    onChange={(e) =>
                      updateDraft({
                        ordering: {
                          maxItemsPerOrder: Number.parseInt(e.target.value, 10),
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="upsell" className="mt-4">
            <AdminPanel title="Upsell" className="max-w-none">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Hrana posle pića">
                  <Switch
                    checked={effective.upsell.foodAfterDrinks}
                    onCheckedChange={(checked) =>
                      updateDraft({ upsell: { foodAfterDrinks: checked } })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Desert posle isporuke">
                  <Switch
                    checked={effective.upsell.dessertAfterDelivered}
                    onCheckedChange={(checked) =>
                      updateDraft({
                        upsell: { dessertAfterDelivered: checked },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Kašnjenje deserta (min)">
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={effective.upsell.dessertDelayMinutes}
                    onChange={(e) =>
                      updateDraft({
                        upsell: {
                          dessertDelayMinutes: Number.parseInt(e.target.value, 10),
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Max upsell po sesiji">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={effective.upsell.maxUpsellsPerSession}
                    onChange={(e) =>
                      updateDraft({
                        upsell: {
                          maxUpsellsPerSession: Number.parseInt(
                            e.target.value,
                            10
                          ),
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Poštuj odbijanje">
                  <Switch
                    checked={effective.upsell.respectDecline}
                    onCheckedChange={(checked) =>
                      updateDraft({ upsell: { respectDecline: checked } })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="proactive" className="mt-4">
            <AdminPanel title="Proaktivno" className="max-w-none">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Welcome posle skena (sek)">
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={effective.proactive.guestWelcomeSeconds}
                    onChange={(e) =>
                      updateDraft({
                        proactive: {
                          guestWelcomeSeconds: Number.parseInt(
                            e.target.value,
                            10
                          ),
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Browse follow-up (sek)">
                  <Input
                    type="number"
                    min={30}
                    max={300}
                    value={effective.proactive.browseFollowUpSeconds}
                    onChange={(e) =>
                      updateDraft({
                        proactive: {
                          browseFollowUpSeconds: Number.parseInt(
                            e.target.value,
                            10
                          ),
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
                <FieldRow label="Bill prompt (min)">
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={effective.proactive.billPromptMinutes}
                    onChange={(e) =>
                      updateDraft({
                        proactive: {
                          billPromptMinutes: Number.parseInt(e.target.value, 10),
                        },
                      })
                    }
                    disabled={!snapshot.canEdit}
                  />
                </FieldRow>
              </div>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="playbook" className="mt-4">
            {playbookSnapshot ? (
              <DenisPlaybookPanel snapshot={playbookSnapshot} />
            ) : (
              <AdminPanel title="Playbook" className="max-w-none">
                <p className="text-sm text-muted-foreground">
                  Playbook pack nije dostupan za ovu lokaciju.
                </p>
              </AdminPanel>
            )}
          </TabsContent>

          <TabsContent value="ab" className="mt-4 space-y-4">
            <AdminPanel
              title="A/B test tona"
              description="50/50 split — auto-evaluacija upsell accept rate."
              className="max-w-none"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Ton A">
                  <Select
                    value={abToneA}
                    onValueChange={(v) => setAbToneA(v as ConciergeTone)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Ton B">
                  <Select
                    value={abToneB}
                    onValueChange={(v) => setAbToneB(v as ConciergeTone)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
              <AdminPanelSection className="mt-4 text-sm">
                <p className="font-medium text-foreground">
                  Simulacija evaluacije (upsell_accept_rate)
                </p>
                <p className="mt-2 text-muted-foreground">
                  A: {Math.round(abPreview.variantAMetric * 100)}% · B:{" "}
                  {Math.round(abPreview.variantBMetric * 100)}% · Pobednik:{" "}
                  {abPreview.winner}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {abPreview.recommendation}
                </p>
              </AdminPanelSection>
              <Button asChild variant="outline" className="mt-4" size="sm">
                <Link href="/admin/ab-experiments">
                  <FlaskConical className="mr-2 size-4" />
                  Pokreni live A/B eksperiment
                </Link>
              </Button>
            </AdminPanel>
          </TabsContent>

          <TabsContent value="io" className="mt-4">
            <AdminPanel title="Import / Export" className="max-w-none">
              <FieldRow label="JSON backup ili kopija iz druge lokacije">
                <Textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='{"persona":{"tone":"formal"}}'
                  disabled={!snapshot.canEdit}
                />
              </FieldRow>
              {snapshot.canEdit && (
                <Button
                  type="button"
                  className="mt-3"
                  onClick={onImport}
                  disabled={pending || !importText.trim()}
                >
                  Uvezi JSON
                </Button>
              )}
            </AdminPanel>
          </TabsContent>
        </Tabs>
      </div>

      <PreviewPanel config={effective} />
    </div>
  );
}
