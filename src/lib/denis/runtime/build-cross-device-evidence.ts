import {
  formatCrossDeviceContextBlock,
  resolveCrossDeviceSync,
  type DeviceContext,
} from "@/lib/denis/actor/cross-device-sync";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import { buildDeviceContextsFromParty } from "@/lib/denis/venue/party";
import type { TablePartyModel } from "@/lib/denis/venue/party/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function toActorDeviceContexts(
  party: TablePartyModel,
  conversationTailByDevice: Record<string, string[]>
): DeviceContext[] {
  return buildDeviceContextsFromParty({
    devices: party.devices,
    conversationTailByDevice,
  });
}

/** Build FSP cross-device block when multiple devices share a table session. */
export function buildCrossDeviceEvidenceBlock(input: {
  party: TablePartyModel | null | undefined;
  currentDevice: string | null | undefined;
  timeline: DenisTimelineRow[];
}): string | null {
  if (!input.party || input.party.activeDeviceCount <= 1) return null;
  if (!input.currentDevice?.trim()) return null;

  const tail = foldTranscriptFromTimeline(input.timeline)
    .slice(-3)
    .map(
      (entry) =>
        `${entry.role === "guest" ? "Guest" : "Denis"}: ${entry.text}`
    );

  const contexts = toActorDeviceContexts(input.party, {
    [input.currentDevice]: tail,
  });

  const actions = resolveCrossDeviceSync(
    contexts,
    input.currentDevice,
    "message_sent",
    input.party.partyMode
  );

  const merged = actions.find(
    (action): action is Extract<typeof action, { action: "merge_context" }> =>
      action.action === "merge_context"
  );

  return merged ? formatCrossDeviceContextBlock(merged.combined) : null;
}

export function resolveCrossDeviceCartSyncActions(input: {
  party: TablePartyModel | null | undefined;
  currentDevice: string | null | undefined;
}): ReturnType<typeof resolveCrossDeviceSync> {
  if (!input.party || !input.currentDevice?.trim()) return [];

  const contexts = toActorDeviceContexts(input.party, {});
  return resolveCrossDeviceSync(
    contexts,
    input.currentDevice,
    "cart_updated",
    input.party.partyMode
  );
}
