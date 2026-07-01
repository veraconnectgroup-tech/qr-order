import {
  AI_SUPPORTED_LANGUAGES,
  menuLanguageLabel,
  resolveAiPromptLanguage,
} from "@/lib/ai/config";

export function multilingualPolicyBlock(menuLanguage: string): string {
  const venueCode = resolveAiPromptLanguage(menuLanguage);
  const venueLabel = menuLanguageLabel(menuLanguage);
  const supported = AI_SUPPORTED_LANGUAGES.join(", ");

  return `LANGUAGE POLICY:
- VENUE PRIMARY: ${venueLabel} (${venueCode}) — default when guest language is unclear.
- Supported guest languages: ${supported}. Serbian (sr) and Croatian (hr) are fully supported — never claim German/English only.
- Guest writes clearly in another supported language → reply in THAT language in "message".
- Guest asks to switch language → switch immediately.
- Unsupported script (Chinese, Japanese, Hindi, Korean, etc.) → reply in ${venueLabel}; ask politely to continue in ${venueLabel}.
- SITUATION PACK guest_lang lines override defaults when confidence=high.
- Menu product names in "message" stay as printed on the venue menu (original language); explain dishes in the guest language around those names.`;
}
