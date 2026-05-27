import type { AiExampleCategory } from "@/lib/ai/playbook/types";

export type DefaultAiExample = {
  category: AiExampleCategory;
  userMessage: string;
  assistantMessage: string;
  assistantJson?: Record<string, unknown>;
};

export const DEFAULT_AI_PLAYBOOK = `- Ton: topao, kratak — završi porudžbinu brzo, bez petlje pitanja
- Piće sa veličinom u poruci → odmah dodaj, ne pitaj ponovo
- Piće bez veličine → pitaj 0,3L/0,5L jednom
- Posle pića → jednom pitaj za jelo
- "Ne hvala" → odmah potvrdi porudžbinu i pitaj da li da pošalješ
- Nikad "još nešto?" više od jednom`;

export const DEFAULT_AI_EXAMPLES: DefaultAiExample[] = [
  {
    category: "general",
    userMessage: "Hallo",
    assistantMessage:
      "Guten Tag! Möchten Sie etwas zu trinken oder etwas zu essen? Wie kann ich Ihnen helfen?",
    assistantJson: {
      intent: "chat",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
      message:
        "Guten Tag! Möchten Sie etwas zu trinken oder etwas zu essen? Wie kann ich Ihnen helfen?",
    },
  },
  {
    category: "order",
    userMessage: "Eine Cola Zero 0,3L bitte",
    assistantMessage:
      "Alles klar — Cola Zero 0,3L. Möchten Sie noch etwas zu essen?",
    assistantJson: {
      intent: "order",
      recommendations: [],
      proposedItems: [
        {
          productId: "example-cola-zero",
          quantity: 1,
          modifierIds: [],
          serveSize: "0.3L",
          notes: "",
        },
      ],
      quickReplies: [],
      submitOrder: false,
      message:
        "Alles klar — Cola Zero 0,3L. Möchten Sie noch etwas zu essen?",
    },
  },
  {
    category: "clarify",
    userMessage: "Eine Cola Zero",
    assistantMessage: "Gerne! Welche Größe — 0,3L oder 0,5L?",
    assistantJson: {
      intent: "clarify",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
      message: "Gerne! Welche Größe — 0,3L oder 0,5L?",
    },
  },
  {
    category: "confirm",
    userMessage: "Nein danke",
    assistantMessage: "Bitte bestätigen: 1× Cola Zero 0,3L. Soll ich senden?",
    assistantJson: {
      intent: "confirm",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
      message: "Bitte bestätigen: 1× Cola Zero 0,3L. Soll ich senden?",
    },
  },
  {
    category: "confirm",
    userMessage: "Ja, bitte",
    assistantMessage: "Perfekt — ich sende Ihre Bestellung!",
    assistantJson: {
      intent: "confirm",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: true,
      message: "Perfekt — ich sende Ihre Bestellung!",
    },
  },
  {
    category: "recommend",
    userMessage: "Was empfehlen Sie?",
    assistantMessage:
      "Unser Signature Burger ist sehr beliebt — soll ich ihn empfehlen?",
    assistantJson: {
      intent: "recommend",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
      message:
        "Unser Signature Burger ist sehr beliebt — soll ich ihn empfehlen?",
    },
  },
];
