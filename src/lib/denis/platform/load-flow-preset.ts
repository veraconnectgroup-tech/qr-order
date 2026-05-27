import type { z } from "zod";
import { ConciergeFlowPresetSchema } from "@/lib/denis/config/concierge-config.schema";
import denisShortFlow from "@/lib/denis/platform/flows/denis_short.flow.json";
import {
  FlowDefinitionSchema,
  type FlowDefinition,
} from "@/lib/denis/platform/flow-types";

type ConciergeFlowPreset = z.infer<typeof ConciergeFlowPresetSchema>;

const PRESETS: Record<ConciergeFlowPreset, FlowDefinition> = {
  denis_short: FlowDefinitionSchema.parse(denisShortFlow),
  classic_chatty: FlowDefinitionSchema.parse(denisShortFlow),
};

export function getFlowPreset(presetId: ConciergeFlowPreset): FlowDefinition {
  return PRESETS[presetId];
}

export function parseFlowDefinition(raw: unknown): FlowDefinition | null {
  const parsed = FlowDefinitionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
