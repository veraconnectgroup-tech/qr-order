import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import type { TipSplitMode } from "@/lib/denis/commerce/smart-tips";

export type RecordTipSelectionPayload = {
  orderId: string;
  tipAmount: number;
  tipPercent: number | null;
  smartDefaultUsed: boolean;
  presetIndex: number | null;
  tipSplitMode: TipSplitMode;
  denisPromptShown?: boolean;
  experienceScore?: number | null;
  marketRegion?: string;
};

export function resolveTipSplitModeFromParams(
  params: Record<string, unknown> | undefined
): TipSplitMode {
  return params?.tipSplitMode === "pool" ? "pool" : "per_waiter";
}

export function buildRecordTipSelectionPayload(
  input: RecordTipSelectionPayload
): Record<string, unknown> {
  return {
    orderId: input.orderId,
    tipAmount: input.tipAmount,
    tipCents: Math.round(input.tipAmount * 100),
    tipPercent: input.tipPercent,
    smartDefaultUsed: input.smartDefaultUsed,
    presetIndex: input.presetIndex,
    tipSplitMode: input.tipSplitMode,
    denisPromptShown: input.denisPromptShown ?? false,
    experienceScore: input.experienceScore ?? null,
    marketRegion: input.marketRegion ?? null,
  };
}

export function recordTipSelectionCommandMeta() {
  return {
    commandType: COMMERCE_COMMAND_TYPES.recordTipSelection,
    eventType: COMMERCE_EVENT_TYPES.tipSelected,
  };
}

export function recordTipSelectionIdempotencyKey(
  orderId: string,
  tipAmount: number
): string {
  return `tip_selected:${orderId}:${Math.round(tipAmount * 100)}`;
}

export function resolveTipStaffId(input: {
  splitMode: TipSplitMode;
  assignedStaffId: string | null;
}): string | null {
  if (input.splitMode === "pool") return null;
  return input.assignedStaffId;
}
