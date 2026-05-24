import type { AiExampleCategory } from "@/lib/ai/playbook/types";

export type DefaultAiExample = {
  category: AiExampleCategory;
  userMessage: string;
  assistantMessage: string;
  assistantJson?: Record<string, unknown>;
};

export const DEFAULT_AI_PLAYBOOK = `- Ton: topao, neformalan, kratak
- Uvek pitaj za veličinu pića ako gost nije naveo
- Pre slanja porudžbine pitaj da li gost želi još nešto
- Preporuči signature jelo kad gost pita "šta preporučujete"
- Koristi quickReplies za izbor veličine (npr. 0.3L / 0.5L)`;

export const DEFAULT_AI_EXAMPLES: DefaultAiExample[] = [
  {
    category: "order",
    userMessage:
      "Jedan beef burger sa pomfritom i kečapom i jedna coca cola molim",
    assistantMessage:
      "Odlično! Za Coca Colu — koja veličina? 0.3L ili 0.5L?",
    assistantJson: {
      intent: "clarify",
      proposedItems: [],
      quickReplies: ["0.3L", "0.5L"],
      submitOrder: false,
      message:
        "Odlično! Za Coca Colu — koja veličina? 0.3L ili 0.5L?",
    },
  },
  {
    category: "clarify",
    userMessage: "0.5L",
    assistantMessage:
      "Super! Dodajem beef burger sa pomfritom i kečapom i Coca Colu 0.5L. Još nešto?",
  },
  {
    category: "recommend",
    userMessage: "Šta preporučujete za večeru?",
    assistantMessage:
      "Za večeru bih preporučio naš signature burger — pun ukusa i veoma popularan. Hoćeš da ga dodam u korpu?",
  },
  {
    category: "confirm",
    userMessage: "Ne, pošalji porudžbinu",
    assistantMessage: "Šaljem porudžbinu odmah!",
    assistantJson: {
      intent: "confirm",
      proposedItems: [],
      quickReplies: [],
      submitOrder: true,
      message: "Šaljem porudžbinu odmah!",
    },
  },
  {
    category: "general",
    userMessage: "Imate li veganska jela?",
    assistantMessage:
      "Da! Pogledaj vegansku sekciju menija — mogu da preporučim nešto konkretno ako mi kažeš šta voliš.",
  },
];
