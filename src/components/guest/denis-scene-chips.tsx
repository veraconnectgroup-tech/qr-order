"use client";

import { DenisChip } from "@/components/design-system/denis-chip";
import type { Scene } from "@/lib/scene/types";
import { sceneChipsLayer } from "@/lib/scene/layer-utils";

export function DenisSceneChips({
  scene,
  onChipPress,
}: {
  scene: Scene;
  onChipPress: (chipId: string, label: string) => void;
}) {
  const chipsLayer = sceneChipsLayer(scene);
  if (!chipsLayer?.options.length) return null;

  return (
    <div className="mx-4 mb-3 flex flex-wrap gap-2">
      {chipsLayer.options.map((chip) => (
        <DenisChip
          key={chip.id}
          label={chip.label}
          selected={chip.selected}
          onClick={() => onChipPress(chip.id, chip.label)}
        />
      ))}
    </div>
  );
}
