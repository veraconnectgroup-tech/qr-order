import { AI_CONFIG } from "@/lib/ai/config";
import { formatPlaybookBlock } from "@/lib/ai/playbook/format-examples";
import { getCachedPlaybookForLocation } from "@/lib/ai/playbook/load-playbook";
import {
  resolvePlaybookPackDefinition,
  type PlaybookPackDefinition,
} from "@/lib/denis/cognition/manifest/playbook-pack-registry";
import type { VenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";

/** Org manifest wins — two locations in the same chain share one pack (MR-9). */
export function resolvePlaybookPackId(
  orgManifest: VenueManifest | null,
  locationManifest: VenueManifest | null
): string | null {
  return (
    orgManifest?.playbookPackId?.trim() ??
    locationManifest?.playbookPackId?.trim() ??
    null
  );
}

export function formatPlaybookPackBlock(
  packId: string | null | undefined
): string | null {
  const pack = resolvePlaybookPackDefinition(packId);
  if (!pack) return null;
  return formatPlaybookBlock(pack.playbook, pack.examples);
}

function mergePackWithLocationOverlay(
  pack: PlaybookPackDefinition | null,
  locationPlaybook: string | null,
  locationExamples: PlaybookPackDefinition["examples"]
): string | null {
  const mergedPlaybook = [pack?.playbook?.trim(), locationPlaybook?.trim()]
    .filter(Boolean)
    .join("\n\n");

  const mergedExamples = [
    ...(pack?.examples ?? []),
    ...locationExamples.filter((row) => row.is_active),
  ].slice(0, AI_CONFIG.maxPlaybookExamples);

  return formatPlaybookBlock(mergedPlaybook || null, mergedExamples);
}

/**
 * MR-9 — org pack from manifest + optional location DB overlay (`ai_playbook`, `ai_examples`).
 */
export async function loadTurnPlaybookBlock(input: {
  orgId: string;
  locationId: string;
  playbookPackId?: string | null;
}): Promise<string | null> {
  const pack = resolvePlaybookPackDefinition(input.playbookPackId);
  const locationPayload = await getCachedPlaybookForLocation(
    input.orgId,
    input.locationId
  );

  return mergePackWithLocationOverlay(
    pack,
    locationPayload.playbook,
    locationPayload.examples
  );
}
