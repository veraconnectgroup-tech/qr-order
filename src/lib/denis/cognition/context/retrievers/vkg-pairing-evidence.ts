import type { VkgPairingSuggestion } from "@/lib/denis/kernel/vkg/types";

/** VKG pairing hints for LLM perceive — facts only, no invented products. */
export function retrieveVkgPairingEvidence(
  pairings: VkgPairingSuggestion[]
): string | null {
  if (pairings.length === 0) return null;

  const lines = pairings.map((pairing) => {
    const reason = pairing.reason?.trim();
    return reason
      ? `- ${pairing.name} — ${reason}`
      : `- ${pairing.name}`;
  });

  return [
    "VKG PAIRING (verified menu — suggest naturally when guest orders food/drink):",
    ...lines,
    "- Offer at most one pairing as a short question; use exact product names.",
  ].join("\n");
}
