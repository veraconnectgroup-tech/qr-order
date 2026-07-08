import { READ_ONLY_TOOL_CATALOG } from "@/lib/denis/agentic/tool-catalog";
import { SIDE_EFFECTING_TOOL_CATALOG } from "@/lib/denis/agentic/side-effecting-tool-catalog";
import type { AgenticToolDefinition, AgenticToolName } from "@/lib/denis/agentic/tool-catalog";

export function mergeAgenticToolCatalog(input: {
  includeSideEffecting: boolean;
}): Partial<Record<AgenticToolName, AgenticToolDefinition>> {
  if (!input.includeSideEffecting) {
    return { ...READ_ONLY_TOOL_CATALOG };
  }
  return {
    ...READ_ONLY_TOOL_CATALOG,
    ...SIDE_EFFECTING_TOOL_CATALOG,
  };
}
