"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  previewDenisPlaybookPackAction,
  saveDenisPlaybookPackAction,
  type DenisPlaybookEditorSnapshot,
} from "@/lib/admin/denis-playbook-actions";
import type { CustomPlaybookPack } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import {
  PlaybookPackToneSchema,
  PlaybookUpsellStyleSchema,
} from "@/lib/denis/cognition/manifest/playbook-pack-registry";
import { AdminPanel } from "@/components/admin/admin-panel";
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
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_CUSTOM: CustomPlaybookPack = {
  tone: "casual",
  upsellStyle: "gentle",
  languagePreferences: { primary: "de", secondary: "en" },
  signaturePhrases: ["Guten Appetit!"],
  menuHighlights: [],
  forbiddenTopics: ["politika", "religija"],
  welcomeTemplate: "Willkommen bei {orgName}!",
};

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values: string[]): string {
  return values.join("\n");
}

export function DenisPlaybookPanel({
  snapshot,
}: {
  snapshot: DenisPlaybookEditorSnapshot;
}) {
  const [packId, setPackId] = useState(
    snapshot.useLocationOverride
      ? snapshot.locationPlaybookPackId ?? snapshot.orgPlaybookPackId ?? "formal-de"
      : snapshot.orgPlaybookPackId ?? "formal-de"
  );
  const [useLocationOverride, setUseLocationOverride] = useState(
    snapshot.useLocationOverride
  );
  const [customPack, setCustomPack] = useState<CustomPlaybookPack>(
    snapshot.customPlaybookPack ?? DEFAULT_CUSTOM
  );
  const [previewMessage, setPreviewMessage] = useState("Daj mi burger");
  const [previewReply, setPreviewReply] = useState("");
  const [pending, startTransition] = useTransition();

  const isCustom = packId === "custom";

  const effectivePackId = useMemo(() => {
    if (useLocationOverride) return packId;
    return snapshot.orgPlaybookPackId ?? packId;
  }, [packId, snapshot.orgPlaybookPackId, useLocationOverride]);

  function runPreview() {
    startTransition(async () => {
      const result = await previewDenisPlaybookPackAction({
        packId: isCustom ? "custom" : packId,
        customPlaybookPack: isCustom ? customPack : null,
        orgName: snapshot.orgName,
        userMessage: previewMessage,
      });
      setPreviewReply(result.assistantMessage);
    });
  }

  function handleSave() {
    if (!snapshot.canEdit) return;
    startTransition(async () => {
      const result = await saveDenisPlaybookPackAction({
        locationId: snapshot.locationId,
        scope: useLocationOverride ? "location" : "org",
        playbookPackId: packId,
        useLocationOverride,
        customPlaybookPack: isCustom ? customPack : null,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Playbook pack sačuvan.");
    });
  }

  return (
    <div className="space-y-4">
      <AdminPanel
        title="Playbook pack"
        description="Svaki restoran ima ličnost — ton, upsell stil, signature fraze. HQ može postaviti default; lokacija može override (npr. beach bar casual)."
        className="max-w-none"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Predefined pack</Label>
              <Select value={packId} onValueChange={setPackId} disabled={!snapshot.canEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberi pack" />
                </SelectTrigger>
                <SelectContent>
                  {snapshot.packOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label} · {option.tone}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom pack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Override za ovu lokaciju</p>
                <p className="text-xs text-muted-foreground">
                  {snapshot.locationName} — različito od HQ defaulta
                </p>
              </div>
              <Switch
                checked={useLocationOverride}
                onCheckedChange={setUseLocationOverride}
                disabled={!snapshot.canEdit}
              />
            </div>

            {isCustom && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Custom pack</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Tone</Label>
                    <Select
                      value={customPack.tone}
                      onValueChange={(v) =>
                        setCustomPack((row) => ({
                          ...row,
                          tone: v as CustomPlaybookPack["tone"],
                        }))
                      }
                      disabled={!snapshot.canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PlaybookPackToneSchema.map((tone) => (
                          <SelectItem key={tone} value={tone}>
                            {tone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Upsell style</Label>
                    <Select
                      value={customPack.upsellStyle}
                      onValueChange={(v) =>
                        setCustomPack((row) => ({
                          ...row,
                          upsellStyle: v as CustomPlaybookPack["upsellStyle"],
                        }))
                      }
                      disabled={!snapshot.canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PlaybookUpsellStyleSchema.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Welcome template</Label>
                  <Input
                    value={customPack.welcomeTemplate}
                    onChange={(e) =>
                      setCustomPack((row) => ({
                        ...row,
                        welcomeTemplate: e.target.value,
                      }))
                    }
                    disabled={!snapshot.canEdit}
                  />
                </div>
                <div>
                  <Label>Signature phrases (jedna po liniji)</Label>
                  <Textarea
                    rows={2}
                    value={listToLines(customPack.signaturePhrases)}
                    onChange={(e) =>
                      setCustomPack((row) => ({
                        ...row,
                        signaturePhrases: linesToList(e.target.value),
                      }))
                    }
                    disabled={!snapshot.canEdit}
                  />
                </div>
                <div>
                  <Label>Menu highlights</Label>
                  <Textarea
                    rows={2}
                    value={listToLines(customPack.menuHighlights)}
                    onChange={(e) =>
                      setCustomPack((row) => ({
                        ...row,
                        menuHighlights: linesToList(e.target.value),
                      }))
                    }
                    disabled={!snapshot.canEdit}
                  />
                </div>
              </div>
            )}

            {snapshot.canEdit && (
              <Button type="button" disabled={pending} onClick={handleSave}>
                {pending ? "Čuvam…" : "Sačuvaj playbook"}
              </Button>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-sm font-semibold">Ovako bi Denis govorio</p>
            <div>
              <Label className="text-xs">Primer poruke gosta</Label>
              <Input
                value={previewMessage}
                onChange={(e) => setPreviewMessage(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={runPreview}
            >
              Osveži preview
            </Button>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Gost: <span className="text-foreground">{previewMessage}</span>
              </p>
              <p className="text-muted-foreground">Denis ({effectivePackId}):</p>
              <p className="rounded-md bg-card p-3 text-foreground">
                {previewReply || "Klikni Osveži preview"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Effective: {snapshot.effectivePlaybookPackId ?? "—"} · Org:{" "}
              {snapshot.orgPlaybookPackId ?? "—"} · Lokacija:{" "}
              {snapshot.locationPlaybookPackId ?? "—"}
            </p>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
