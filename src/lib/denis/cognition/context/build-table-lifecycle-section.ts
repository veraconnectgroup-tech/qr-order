import type { TableLifecycleOrchestration } from "@/lib/denis/cognition/lifecycle/table-lifecycle-types";

/** Situation pack TABLE LIFECYCLE block — lane + stage instructions for LLM. */
export function buildTableLifecycleSection(
  lifecycle: TableLifecycleOrchestration | null | undefined
): string {
  if (!lifecycle) return "";

  const lines = [
    "TABLE LIFECYCLE:",
    `- stage: ${lifecycle.stage}`,
    `- lane: ${lifecycle.lane}`,
  ];

  if (lifecycle.evidence.length > 0) {
    lines.push(`- signals: ${lifecycle.evidence.join(", ")}`);
  }

  if (lifecycle.lane === "silence") {
    lines.push("- instruction: guest is eating — no upsell, no small talk, service only");
  } else if (lifecycle.lane === "help") {
    lines.push("- instruction: guest needs help choosing — concise recommendations ok");
  } else if (lifecycle.lane === "explore") {
    lines.push("- instruction: guest exploring category — defer generic upsell");
  } else if (lifecycle.stage === "waiting_kitchen") {
    lines.push("- instruction: waiting for food — ETA/empathy ok, no menu upsell");
  } else if (lifecycle.stage === "dessert") {
    lines.push("- instruction: dessert window — dessert/coffee upsell ok");
  } else if (lifecycle.stage === "post_meal") {
    lines.push("- instruction: post meal — bill/coffee/digestif, no food upsell");
  }

  if (lifecycle.sommelierEligible) {
    lines.push("- sommelier: drink pairing/refill window open");
  }

  return lines.join("\n");
}
