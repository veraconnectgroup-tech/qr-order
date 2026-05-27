"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  loadDenisRolloutAdminState,
  saveDenisRolloutConfig,
  type DenisRolloutAdminState,
} from "@/lib/admin/denis-rollout-actions";
import {
  DENIS_ROLLOUT_PRESETS,
  denisRolloutFormFromPreset,
  type DenisRolloutFormState,
  type DenisRolloutPresetId,
} from "@/lib/denis/config/rollout-cutover";
import type { ConciergeRolloutMode } from "@/lib/denis/config/rollout";
import {
  kernelTimelineEnabled,
  resolveGuestLegacyPath,
  shouldRunShadowDiff,
} from "@/lib/denis/config/rollout";
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
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";

const ROLLOUT_MODES: Array<{
  value: ConciergeRolloutMode;
  label: string;
  hint: string;
}> = [
  {
    value: "legacy",
    label: "Legacy",
    hint: "No Denis timeline; legacy chat only.",
  },
  {
    value: "shadow",
    label: "Shadow",
    hint: "Guests see legacy; kernel + timeline + shadow diff.",
  },
  {
    value: "canary",
    label: "Canary",
    hint: "Stable % of table sessions see Denis; others stay legacy.",
  },
  {
    value: "denis_only",
    label: "Denis only",
    hint: "Guests see linted Denis when narrate flag is on.",
  },
];

type Props = {
  initial: DenisRolloutAdminState;
};

export function DenisRolloutPanel({ initial }: Props) {
  const [form, setForm] = useState<DenisRolloutFormState>(initial.effective);
  const [flags, setFlags] = useState({
    guestSeesLegacy: initial.guestSeesLegacy,
    timelineEnabled: initial.timelineEnabled,
    shadowDiffEnabled: initial.shadowDiffEnabled,
    envOverride: initial.envRolloutOverride,
  });
  const [saving, setSaving] = useState(false);

  function syncFlags(next: DenisRolloutFormState) {
    setFlags((f) => ({
      ...f,
      guestSeesLegacy: resolveGuestLegacyPath(next.rolloutMode, {
        canaryPercent: next.canaryPercent,
      }),
      timelineEnabled: kernelTimelineEnabled(next.rolloutMode),
      shadowDiffEnabled: shouldRunShadowDiff(next.rolloutMode),
    }));
  }

  function applyPreset(presetId: DenisRolloutPresetId) {
    const next = denisRolloutFormFromPreset(presetId);
    if (!next) return;
    setForm(next);
    syncFlags(next);
  }

  function updateForm<K extends keyof DenisRolloutFormState>(
    key: K,
    value: DenisRolloutFormState[K]
  ) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "rolloutMode" || key === "canaryPercent") {
        syncFlags(next);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const result = await saveDenisRolloutConfig(form);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const refreshed = await loadDenisRolloutAdminState();
    if (!("error" in refreshed)) {
      setForm(refreshed.effective);
      setFlags({
        guestSeesLegacy: refreshed.guestSeesLegacy,
        timelineEnabled: refreshed.timelineEnabled,
        shadowDiffEnabled: refreshed.shadowDiffEnabled,
        envOverride: refreshed.envRolloutOverride,
      });
    }

    toast.success("Denis rollout saved");
  }

  const actSubmitRisk =
    form.actSubmitEnabled && form.actLayerEnabled && !form.actDryRun;

  return (
    <QrCard className="max-w-2xl">
      <QrCardTitle>Denis rollout</QrCardTitle>
      <QrCardDescription>
        Ops cutover ladder for this location — stored in{" "}
        <code className="rounded bg-muted px-1 text-xs text-foreground">
          ai_concierge_config
        </code>
        .
      </QrCardDescription>

      {flags.envOverride && (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Platform env <strong>DENIS_ROLLOUT_MODE={flags.envOverride}</strong>{" "}
          overrides location rollout until removed.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {DENIS_ROLLOUT_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Presets set recommended flags — review before saving.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="rollout-mode">Rollout mode</Label>
          <Select
            value={form.rolloutMode}
            onValueChange={(value) =>
              updateForm("rolloutMode", value as ConciergeRolloutMode)
            }
          >
            <SelectTrigger id="rollout-mode" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLLOUT_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            {ROLLOUT_MODES.find((m) => m.value === form.rolloutMode)?.hint}
          </p>
        </div>

        {form.rolloutMode === "canary" && (
          <div>
            <Label htmlFor="canary-percent">Canary cohort %</Label>
            <Input
              id="canary-percent"
              type="number"
              min={0}
              max={100}
              className="mt-1.5 max-w-[8rem]"
              value={form.canaryPercent}
              onChange={(e) =>
                updateForm(
                  "canaryPercent",
                  Math.min(100, Math.max(0, Number(e.target.value) || 0))
                )
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              ~{form.canaryPercent}% of table sessions (by QR token) see Denis
              guest path. Per-session assignment is stable.
            </p>
          </div>
        )}

        <dl className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted p-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Guest path</dt>
            <dd className="font-medium">
              {form.rolloutMode === "canary"
                ? `~${form.canaryPercent}% Denis`
                : flags.guestSeesLegacy
                  ? "Legacy"
                  : "Denis"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Timeline</dt>
            <dd className="font-medium">
              {flags.timelineEnabled ? "On" : "Off"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shadow diff</dt>
            <dd className="font-medium">
              {flags.shadowDiffEnabled ? "On" : "Off"}
            </dd>
          </div>
        </dl>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">Feature flags</p>

          <FlagRow
            label="T3 narrate with LLM"
            description="Facts-only Denis voice when rollout is denis_only."
            checked={form.narrateWithLlm}
            onCheckedChange={(v) => updateForm("narrateWithLlm", v)}
          />
          <FlagRow
            label="T2 slot extract"
            description="Timeline slot.extracted; legacy still orders."
            checked={form.slotExtractEnabled}
            onCheckedChange={(v) => updateForm("slotExtractEnabled", v)}
          />
          <FlagRow
            label="T2 slot LLM fallback"
            description="LLM when heuristic extract finds nothing."
            checked={form.slotExtractWithLlm}
            onCheckedChange={(v) => updateForm("slotExtractWithLlm", v)}
          />
          <FlagRow
            label="Return-guest memory"
            description="Consented prefs + welcome (requires migration 00092)."
            checked={form.returnGuestEnabled}
            onCheckedChange={(v) => updateForm("returnGuestEnabled", v)}
          />
          <FlagRow
            label="Voice surface"
            description="Mic input on guest menu."
            checked={form.voiceEnabled}
            onCheckedChange={(v) => updateForm("voiceEnabled", v)}
          />
          <FlagRow
            label="Act layer"
            description="Execute planned skills on timeline."
            checked={form.actLayerEnabled}
            onCheckedChange={(v) => updateForm("actLayerEnabled", v)}
          />
          <FlagRow
            label="Act dry-run"
            description="Log skill.executed without Order Core submit."
            checked={form.actDryRun}
            disabled={!form.actLayerEnabled}
            onCheckedChange={(v) => updateForm("actDryRun", v)}
          />
          <FlagRow
            label="Act submit orders"
            description="ACL path to create-order — high risk."
            checked={form.actSubmitEnabled}
            disabled={!form.actLayerEnabled}
            onCheckedChange={(v) => updateForm("actSubmitEnabled", v)}
          />
        </div>

        {actSubmitRisk && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            Order submit via Denis ACL is enabled. Confirm venue is ready for
            cutover from legacy executor.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save rollout"}
        </Button>
        <Link
          href="/admin/denis-debug"
          className="text-sm text-primary hover:underline"
        >
          Open Denis debugger →
        </Link>
        <Link
          href="/admin/denis-sim"
          className="text-sm text-primary hover:underline"
        >
          Venue sim →
        </Link>
      </div>
    </QrCard>
  );
}

function FlagRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}
