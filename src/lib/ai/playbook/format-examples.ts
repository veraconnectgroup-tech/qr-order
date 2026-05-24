import type { AiExampleRow } from "@/lib/ai/playbook/types";

function exampleToAssistantJson(example: AiExampleRow): string {
  if (example.assistant_json && typeof example.assistant_json === "object") {
    return JSON.stringify(example.assistant_json);
  }

  return JSON.stringify({
    intent:
      example.category === "order"
        ? "order"
        : example.category === "recommend"
          ? "recommend"
          : example.category === "clarify"
            ? "clarify"
            : example.category === "confirm"
              ? "confirm"
              : "chat",
    recommendations: [],
    proposedItems: [],
    quickReplies: [],
    submitOrder: example.category === "confirm",
    message: example.assistant_message,
  });
}

export function formatPlaybookBlock(
  playbook: string | null,
  examples: AiExampleRow[]
): string | null {
  const parts: string[] = [];

  if (playbook?.trim()) {
    parts.push(
      "RESTAURANT PLAYBOOK (house rules — follow strictly):",
      playbook.trim()
    );
  }

  const active = examples.filter((e) => e.is_active);
  if (active.length) {
    parts.push(
      "EXAMPLE CONVERSATIONS (match this tone and JSON structure):"
    );
    for (const example of active) {
      parts.push(`User: "${example.user_message}"`);
      parts.push(`Assistant: ${exampleToAssistantJson(example)}`);
      parts.push("");
    }
  }

  return parts.length ? parts.join("\n").trim() : null;
}
