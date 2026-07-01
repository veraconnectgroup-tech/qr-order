"use client";

import { DenisChip } from "@/components/design-system/denis-chip";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useGuestAccessibility } from "@/components/guest/guest-accessibility-provider";
import type { Scene } from "@/lib/scene/types";
import { sceneChipsLayer } from "@/lib/scene/layer-utils";

import { TABLE_ACTION_CHIP_IDS } from "@/lib/scene/resolve-table-actions";

const CHIP_I18N: Record<string, string> = {
  "situation-wrong": "scene.situation.chipWrong",
  "situation-waiter": "scene.situation.chipWaiter",
  [TABLE_ACTION_CHIP_IDS.orderMore]: "scene.action.orderMore",
  [TABLE_ACTION_CHIP_IDS.viewBill]: "scene.action.viewBill",
};

function resolveChipLabel(
  chip: { id: string; label: string },
  tUI: (key: string) => string
): string {
  const key = CHIP_I18N[chip.id];
  if (key) return tUI(key);
  return chip.label;
}

export function DenisSceneChips({
  scene,
  onChipPress,
}: {
  scene: Scene;
  onChipPress: (chipId: string, label: string) => void;
}) {
  const { tUI } = useAppLocale();
  const { prefs: a11yPrefs } = useGuestAccessibility();
  const chipsLayer = sceneChipsLayer(scene);
  if (!chipsLayer?.options.length) return null;

  return (
    <div
      role="group"
      aria-label={tUI("a11y.chatConversation")}
      className="flex flex-wrap gap-2"
    >
      {chipsLayer.options.map((chip) => {
        const label = resolveChipLabel(chip, tUI);
        return (
          <DenisChip
            key={chip.id}
            label={label}
            selected={chip.selected}
            style={{ minHeight: `${a11yPrefs.chipMinHeightPx}px` }}
            onClick={() => onChipPress(chip.id, label)}
          />
        );
      })}
    </div>
  );
}
