"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  loadDenisProactiveAdminState,
  saveDenisProactiveSettings,
  type DenisProactiveAdminState,
} from "@/lib/admin/denis-proactive-actions";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";

type Props = {
  initial: DenisProactiveAdminState;
};

type ProactiveSettings = ConciergeConfig["proactive"];

function FeatureRow({
  label,
  enabled,
  onEnabledChange,
  thresholdLabel,
  thresholdValue,
  onThresholdChange,
  thresholdType = "number",
}: {
  label: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  thresholdLabel?: string;
  thresholdValue?: string | number;
  onThresholdChange?: (value: string) => void;
  thresholdType?: "number" | "time";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      {thresholdLabel && onThresholdChange != null && thresholdValue != null ? (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">{thresholdLabel}</Label>
          <Input
            type={thresholdType}
            className="h-8 w-24"
            value={String(thresholdValue)}
            onChange={(event) => onThresholdChange(event.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DenisProactiveSettingsPanel({ initial }: Props) {
  const [settings, setSettings] = useState<ProactiveSettings>(initial.proactive);
  const [saving, setSaving] = useState(false);

  function patch(partial: Partial<ProactiveSettings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    const result = await saveDenisProactiveSettings(settings);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Proactive settings saved.");
    const refreshed = await loadDenisProactiveAdminState();
    if (!("error" in refreshed)) {
      setSettings(refreshed.proactive);
    }
  }

  return (
    <QrCard className="mt-8">
      <QrCardTitle>Proactive Features</QrCardTitle>
      <QrCardDescription>
        Denis prati sesije i reaguje na vreme — gost, konobar i menadžer. Max 1
        poruka po tipu po sesiji.
      </QrCardDescription>

      <div className="mt-4 space-y-1">
        <FeatureRow
          label="Pozdrav nakon skeniranja QR"
          enabled={settings.guestWelcome}
          onEnabledChange={(value) => patch({ guestWelcome: value })}
          thresholdLabel="sekundi"
          thresholdValue={settings.guestWelcomeSeconds}
          onThresholdChange={(value) =>
            patch({ guestWelcomeSeconds: Number(value) || 30 })
          }
        />
        <FeatureRow
          label="Upsell dezerta"
          enabled={settings.dessert}
          onEnabledChange={(value) => patch({ dessert: value })}
        />
        <FeatureRow
          label="Status kad narudžbina kasni"
          enabled={settings.orderDelay}
          onEnabledChange={(value) => patch({ orderDelay: value })}
          thresholdLabel="min"
          thresholdValue={settings.orderDelayMinutes}
          onThresholdChange={(value) =>
            patch({ orderDelayMinutes: Number(value) || 15 })
          }
        />
        <FeatureRow
          label="Ponudi račun"
          enabled={settings.billPrompt}
          onEnabledChange={(value) => patch({ billPrompt: value })}
          thresholdLabel="min"
          thresholdValue={settings.billPromptMinutes}
          onThresholdChange={(value) =>
            patch({ billPromptMinutes: Number(value) || 20 })
          }
        />
        <FeatureRow
          label="Preporuka po popularnosti (meni idle)"
          enabled={settings.popularityPairing}
          onEnabledChange={(value) => patch({ popularityPairing: value })}
          thresholdLabel="min"
          thresholdValue={settings.popularityBrowseMinutes}
          onThresholdChange={(value) =>
            patch({ popularityBrowseMinutes: Number(value) || 1 })
          }
        />
        <FeatureRow
          label="Staff alert: sto čeka"
          enabled={settings.staffTableIdle}
          onEnabledChange={(value) => patch({ staffTableIdle: value })}
          thresholdLabel="min"
          thresholdValue={settings.staffTableIdleMinutes}
          onThresholdChange={(value) =>
            patch({ staffTableIdleMinutes: Number(value) || 15 })
          }
        />
        <FeatureRow
          label="Staff alert: alergija"
          enabled={settings.staffAllergy}
          onEnabledChange={(value) => patch({ staffAllergy: value })}
        />
        <FeatureRow
          label="Staff alert: traži konobara"
          enabled={settings.staffWaiterRequest}
          onEnabledChange={(value) => patch({ staffWaiterRequest: value })}
        />
        <FeatureRow
          label="Dnevna priprema za konobare"
          enabled={settings.dailyPrep}
          onEnabledChange={(value) => patch({ dailyPrep: value })}
          thresholdLabel="vreme"
          thresholdValue={settings.dailyPrepHour}
          onThresholdChange={(value) => patch({ dailyPrepHour: value })}
          thresholdType="time"
        />
        <FeatureRow
          label="Dnevni izveštaj"
          enabled={settings.dailyReport}
          onEnabledChange={(value) => patch({ dailyReport: value })}
          thresholdLabel="vreme"
          thresholdValue={settings.dailyReportHour}
          onThresholdChange={(value) => patch({ dailyReportHour: value })}
          thresholdType="time"
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Switch
          checked={settings.enabled}
          onCheckedChange={(value) => patch({ enabled: value })}
        />
        <span className="text-sm font-medium">Proaktivni Denis uključen</span>
      </div>

      <Button className="mt-6" onClick={() => void handleSave()} disabled={saving}>
        {saving ? "Čuvam…" : "Sačuvaj proactive podešavanja"}
      </Button>
    </QrCard>
  );
}
