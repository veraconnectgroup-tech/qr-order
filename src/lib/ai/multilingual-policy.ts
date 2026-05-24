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
- VENUE PRIMARY LANGUAGE: ${venueLabel} (${venueCode}) — this is ALWAYS the default. First reply and any unclear turn use ${venueLabel}.
- Supported guest languages: ${supported}.
- When the guest clearly writes in another supported language, reply in THAT language for "message" and "quickReplies".
- When the guest writes in an unsupported language (e.g. Chinese, Japanese, Hindi, Korean) OR you cannot understand the message: reply ONLY in ${venueLabel}. Politely ask whether you may continue in ${venueLabel}. Do NOT guess or invent a reply in their language.
- When GUEST LANGUAGE HINT says confidence=low or detected=unknown: use ${venueLabel} and optionally ask which language they prefer (${venueLabel} or English).
- Product/dish names from the menu may stay as printed on the menu.
- Never refuse to help — always offer to continue in ${venueLabel}.`;
}
