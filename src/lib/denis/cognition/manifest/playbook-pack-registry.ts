import type { AiExampleRow } from "@/lib/ai/playbook/types";

export type PlaybookPackDefinition = {
  id: string;
  playbook: string;
  examples: AiExampleRow[];
};

function packExample(
  category: AiExampleRow["category"],
  userMessage: string,
  assistantMessage: string,
  assistantJson?: Record<string, unknown>
): AiExampleRow {
  return {
    id: `pack-${category}`,
    org_id: "pack",
    location_id: null,
    category,
    user_message: userMessage,
    assistant_message: assistantMessage,
    assistant_json: assistantJson ?? null,
    sort_order: 0,
    is_active: true,
  };
}

/** Platform playbook packs — org manifest `playbookPackId` (MR-9). */
export const PLAYBOOK_PACK_REGISTRY: Record<string, PlaybookPackDefinition> = {
  skyline: {
    id: "skyline",
    playbook: [
      "SKYLINE LOUNGE PLAYBOOK:",
      "- Ton: topli boutique lounge — kratko, luksuzno, bez hotelskog šablona",
      "- Pozdrav: spomeni Skyline atmosferu; ponudi koktel ili vino pre jela",
      "- Nikad generički „Dobrodošli u restoran“ — uvek Skyline Lounge",
      "- Piće: preporuči signature koktel ili lokalno vino kad gost traži preporuku",
    ].join("\n"),
    examples: [
      packExample(
        "general",
        "Zdravo",
        "Dobro veče — dobrodošli u Skyline Lounge. Da li želite koktel ili čašu vina dok birate?",
        {
          intent: "chat",
          recommendations: [],
          proposedItems: [],
          quickReplies: [],
          submitOrder: false,
          message:
            "Dobro veče — dobrodošli u Skyline Lounge. Da li želite koktel ili čašu vina dok birate?",
        }
      ),
    ],
  },
  "generic-chain": {
    id: "generic-chain",
    playbook: [
      "CHAIN HOTEL PLAYBOOK:",
      "- Ton: neutralan, efikasan, brend-kompatibilan — bez lokalnog imena lokala",
      "- Pozdrav: kratak hotelski standard; pitaj šta gost želi da naruči",
      "- Bez boutique ili signature preporuka — samo jasna pitanja za porudžbinu",
      "- Piće: pitaj veličinu/tip jednom, bez storytellinga",
    ].join("\n"),
    examples: [
      packExample(
        "general",
        "Hello",
        "Good evening. What would you like to order — a drink or something to eat?",
        {
          intent: "chat",
          recommendations: [],
          proposedItems: [],
          quickReplies: [],
          submitOrder: false,
          message:
            "Good evening. What would you like to order — a drink or something to eat?",
        }
      ),
    ],
  },
};

export function resolvePlaybookPackDefinition(
  packId: string | null | undefined
): PlaybookPackDefinition | null {
  const trimmed = packId?.trim();
  if (!trimmed) return null;
  return PLAYBOOK_PACK_REGISTRY[trimmed] ?? null;
}
