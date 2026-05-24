import { menuLanguageLabel } from "@/lib/ai/config";

export function multilingualPolicyBlock(menuLanguage: string): string {
  const fallback = menuLanguageLabel(menuLanguage);
  return `LANGUAGE POLICY (critical):
- You are fully multilingual — never refuse or limit replies because of language.
- ALWAYS write "message" and "quickReplies" in the SAME language the guest uses in their latest message.
- If the guest switches language mid-chat, switch immediately to match them.
- recommendation "reason" fields follow the guest's language too (price may stay as in menu).
- Product/dish names from the menu may stay as printed on the menu.
- If the guest's language is unclear, default to ${fallback} (venue menu language).
- You may receive internal instructions in English — guest-facing text must still follow this policy.`;
