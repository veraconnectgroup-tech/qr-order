import { AI_CONFIG } from "@/lib/ai/config";
import { formatPlaybookBlock } from "@/lib/ai/playbook/format-examples";
import { getCachedPlaybookForLocation } from "@/lib/ai/playbook/load-playbook";
import {
  interpolateWelcomeTemplate,
  resolvePlaybookPackDefinition,
  type PlaybookPackDefinition,
} from "@/lib/denis/cognition/manifest/playbook-pack-registry";
import type {
  CustomPlaybookPack,
  VenueManifest,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";

/** Location manifest wins — beach bar can override HQ formal pack (MR-9 / Prompt 36). */
export function resolvePlaybookPackId(
  orgManifest: VenueManifest | null,
  locationManifest: VenueManifest | null
): string | null {
  return (
    locationManifest?.playbookPackId?.trim() ??
    orgManifest?.playbookPackId?.trim() ??
    null
  );
}

export function resolveCustomPlaybookPack(
  orgManifest: VenueManifest | null,
  locationManifest: VenueManifest | null
): CustomPlaybookPack | null {
  return (
    locationManifest?.customPlaybookPack ??
    orgManifest?.customPlaybookPack ??
    null
  );
}

export function formatPlaybookPackBlockFromDefinition(
  pack: PlaybookPackDefinition,
  orgName?: string | null
): string | null {
  const welcomeLine = orgName
    ? `Resolved welcome: ${interpolateWelcomeTemplate(pack.welcomeTemplate, orgName)}`
    : null;

  const enrichedPlaybook = [pack.playbook, welcomeLine].filter(Boolean).join("\n");
  return formatPlaybookBlock(enrichedPlaybook, pack.examples);
}

export function formatPlaybookPackBlock(
  packId: string | null | undefined,
  options?: {
    customPack?: CustomPlaybookPack | null;
    orgName?: string | null;
  }
): string | null {
  const pack = resolvePlaybookPackDefinition(packId, options?.customPack);
  if (!pack) return null;
  return formatPlaybookPackBlockFromDefinition(pack, options?.orgName);
}

/** Deterministic preview for admin — no LLM. */
export function previewPlaybookPackTurn(input: {
  packId: string | null | undefined;
  customPack?: CustomPlaybookPack | null;
  orgName: string;
  userMessage?: string;
}): { assistantMessage: string; playbookBlock: string | null } {
  const pack = resolvePlaybookPackDefinition(input.packId, input.customPack);
  if (!pack) {
    return { assistantMessage: "", playbookBlock: null };
  }

  const userMessage = input.userMessage?.trim() || "Daj mi burger";
  const example =
    pack.examples.find((row) => row.user_message === userMessage) ??
    pack.examples.find((row) => row.category === "order") ??
    pack.examples[0];

  const assistantMessage =
    example?.assistant_message ??
    `${interpolateWelcomeTemplate(pack.welcomeTemplate, input.orgName)} ${pack.signaturePhrases[0] ?? ""}`.trim();

  return {
    assistantMessage,
    playbookBlock: formatPlaybookPackBlockFromDefinition(pack, input.orgName),
  };
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
  customPlaybookPack?: CustomPlaybookPack | null;
  orgName?: string | null;
}): Promise<string | null> {
  const pack = resolvePlaybookPackDefinition(
    input.playbookPackId,
    input.customPlaybookPack
  );
  const locationPayload = await getCachedPlaybookForLocation(
    input.orgId,
    input.locationId
  );

  const enrichedPack = pack
    ? {
        ...pack,
        playbook: [
          pack.playbook,
          input.orgName
            ? `Resolved welcome: ${interpolateWelcomeTemplate(pack.welcomeTemplate, input.orgName)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      }
    : null;

  return mergePackWithLocationOverlay(
    enrichedPack,
    locationPayload.playbook,
    locationPayload.examples
  );
}
