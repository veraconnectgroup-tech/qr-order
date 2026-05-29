import {
  AI_SUPPORTED_LANGUAGES,
  menuLanguageLabel,
  resolveAiPromptLanguage,
} from "@/lib/ai/config";

export function multilingualPolicyBlock(menuLanguage: string): string {
  const venueCode = resolveAiPromptLanguage(menuLanguage);
  const venueLabel = menuLanguageLabel(menuLanguage);
  const supported = AI_SUPPORTED_LANGUAGES.join(", ");

  return `LANGUAGE POLICY (critical):
- VENUE PRIMARY LANGUAGE: ${venueLabel} (${venueCode}) — default when the guest language is unclear. First reply and any unclear turn use ${venueLabel}.
- Supported guest languages: ${supported}. Serbian (sr) and Croatian (hr) are FULLY supported — never claim you can only speak German or English.
- When the guest clearly writes in another supported language, reply in THAT language for "message" and "quickReplies".
- When the guest asks to switch language ("auf Serbisch", "na srpskom", "in English"), switch immediately and reply in that language.
- When the guest writes in an unsupported script (e.g. Chinese, Japanese, Hindi, Korean): reply in ${venueLabel}. Politely ask whether you may continue in ${venueLabel}. Do NOT invent replies in their language.
- When GUEST LANGUAGE HINT says confidence=low: prefer the guest's latest message language if it looks like Serbian/Croatian/English/German; otherwise use ${venueLabel}.
- Product/dish names from the menu may stay as printed on the menu.
- Never refuse to help — always offer to continue in a supported language.`;
}
