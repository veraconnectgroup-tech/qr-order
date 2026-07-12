import {
  AI_CONFIG,
  detectGuestMessageLanguage,
  estimatePromptTokens,
  menuLanguageLabel,
  resolveAiPromptLanguage,
  type AI_SUPPORTED_LANGUAGES,
} from "@/lib/ai/config";
import { multilingualPolicyBlock } from "@/lib/ai/multilingual-policy";
import type { AiGuestPreferences, BuildSystemPromptInput } from "@/lib/ai/types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  buildPersonalityBlock,
  buildPersonaIdentityBlock,
} from "@/lib/denis/cognition/personality/personality-engine";
import { buildDenisPersonaBlock } from "@/lib/denis/cognition/personality/denis-persona-block";

export type SystemPromptBlockMeasurement = {
  id: string;
  tokens: number;
  chars: number;
};

function formatGuestLanguageSituation(
  guestMessage: string | null | undefined,
  menuLanguage: string,
  venueLang: (typeof AI_SUPPORTED_LANGUAGES)[number]
): string[] {
  const venueLabel = menuLanguageLabel(menuLanguage);

  if (!guestMessage?.trim()) {
    return [`- guest_lang: venue_default (${venueLabel})`];
  }

  const detection = detectGuestMessageLanguage(guestMessage, menuLanguage);
  const replyLang = detection.responseLanguage ?? detection.detected;
  const replyLabel = menuLanguageLabel(
    replyLang === "unknown" ? venueLang : replyLang
  );

  if (detection.detected === "unknown") {
    return [
      `- guest_lang: unsupported_script → reply ONLY in ${venueLabel}`,
      `- guest_lang_confidence: high`,
    ];
  }

  const lines: string[] = [];

  if (detection.responseScript === "latin" && /[\u0400-\u04FF]/.test(guestMessage)) {
    lines.push("- guest_script: cyrillic_input → reply in Latin script (menu uses Latin)");
  }

  if (detection.casualMode) {
    lines.push("- guest_tone: casual (slang detected) → mirror friendly informal tone");
  }

  if (detection.codeSwitched) {
    lines.push(
      `- guest_lang: code_switched → reply in ${replyLabel}; keep original menu item names in ${venueLabel}`
    );
    if (detection.menuItemHints?.length) {
      lines.push(`- menu_item_hints: ${detection.menuItemHints.join(", ")}`);
    }
  }

  if (detection.confidence === "low") {
    return [
      ...lines,
      `- guest_lang: ${replyLabel} (low confidence) → prefer ${venueLabel}; lead with menu choices`,
      `- guest_lang_confidence: low`,
    ];
  }

  if (replyLang !== venueLang) {
    return [
      ...lines,
      `- guest_lang: ${replyLabel} (${replyLang})`,
      `- guest_lang_confidence: ${detection.languageConfidence != null && detection.languageConfidence >= 0.9 ? "locked" : "high"}`,
      `- menu_names: reply in guest language but cite ORIGINAL venue menu dish names with parenthetical translation when helpful (e.g. "The Wiener Schnitzel (breaded veal cutlet)")`,
    ];
  }

  return [
    ...lines,
    `- guest_lang: ${replyLabel} (${replyLang})`,
    `- guest_lang_confidence: ${detection.languageConfidence != null && detection.languageConfidence >= 0.9 ? "locked" : "high"}`,
  ];
}

function formatGuestPrefsSituation(
  prefs: AiGuestPreferences | null | undefined
): string[] {
  if (!prefs) return [];

  const lines: string[] = [];
  const allergies = prefs.allergies.filter(Boolean);
  const mood = prefs.mood?.trim();

  if (allergies.length) {
    lines.push(
      `- allergies: ${allergies.join(", ")} (NEVER recommend dishes that may contain these; exclude when unsure)`
    );
  }
  if (mood) {
    lines.push(`- guest_mood: "${mood}"`);
  }
  if (prefs.formality === "informal") {
    lines.push(
      `- address_style: this guest asked you to drop formal address — use "ti" (or the equivalent informal register in whatever language you're replying in) with THEM for the rest of this session only, never restaurant-wide. A real dose of respect stays regardless — dropping "vi" is not dropping respect.`
    );
  }
  return lines;
}

function servicePeriodBehaviorBlock(
  greeting: string | null | undefined
): string {
  if (!greeting?.trim()) return "";
  return [
    "SERVICE PERIOD (use once at welcome — do not repeat mid-thread):",
    `- greeting: ${greeting.trim()}`,
    "- instruction: Match period tone; breakfast → coffee offer; lunch → daily special; dinner → aperitif; late → bar hours.",
  ].join("\n");
}

function journeyPhaseBehaviorBlock(
  phase: import("@/lib/scene/types").SessionPhase | null | undefined
): string {
  if (!phase) return "";

  const lines = ["JOURNEY PHASE BEHAVIOR:"];

  switch (phase) {
    case "browsing":
    case "latent":
      lines.push("- Help with menu; suggest popular dishes when relevant.");
      break;
    case "ordering":
      lines.push("- Focus on accuracy; ask for missing size/modifiers once.");
      break;
    case "waiting":
      lines.push("- ETA updates OK; light drink suggestion; no food push.");
      break;
    case "eating":
      lines.push("- DO NOT disturb unless guest writes; no proactive nudges.");
      lines.push("- Dessert only after ~15 min since mains delivered.");
      break;
    case "settling":
      lines.push("- Bill, thanks, invite them back — no drink upsell.");
      break;
    case "closed":
      lines.push("- Brief thanks only.");
      break;
    default:
      break;
  }

  return lines.join("\n");
}

function guestMentalModelBehaviorBlock(input: {
  mental?: GuestMentalModel | null;
  evidence?: string | null;
}): string {
  const pace =
    input.mental?.pace ??
    (input.evidence?.includes("pace: rushed") ? "rushed" : null);
  const priceAffinity =
    input.mental?.priceAffinity ??
    (input.evidence?.includes("price_affinity: budget") ? "budget" : null);
  const nudgeBudgetZero =
    input.mental?.nudgeBudget.remaining === 0 ||
    input.evidence?.includes("nudge_budget: 0/");

  const lines: string[] = [];
  if (pace === "rushed") {
    lines.push(
      "RUSHED GUEST:",
      "- Keep replies to 1–2 short sentences.",
      "- No small talk, banter, or leisurely menu exploration.",
      "- Confirm orders fast; skip optional upsell unless guest asks."
    );
  }
  if (priceAffinity === "budget") {
    lines.push(
      "BUDGET GUEST:",
      "- Prefer value-for-money options.",
      "- Never lead with the most expensive items on the menu."
    );
  }
  if (nudgeBudgetZero) {
    lines.push(
      "NUDGE BUDGET EXHAUSTED:",
      "- Service-only tone — status, bill, kitchen updates.",
      "- Do not proactively upsell or suggest add-ons."
    );
  }
  if (!lines.length) return "";
  return lines.join("\n");
}

/** ADR-031 — dynamic turn truth in one pack (cart, orders, browse, guest hints). */
function buildPromptSituationPack(input: BuildSystemPromptInput): string {
  const evidence = input.evidenceBlock?.trim();
  if (evidence?.includes("SITUATION PACK")) {
    return evidence;
  }

  const venueLang = resolveAiPromptLanguage(input.venueMenuLocale ?? input.language);
  const lines = ["SITUATION PACK (truth — do not contradict):"];

  const guestLines = [
    "GUEST:",
    ...formatGuestLanguageSituation(
      input.guestMessage,
      input.venueMenuLocale ?? input.language,
      venueLang
    ),
    ...formatGuestPrefsSituation(input.guestPrefs),
  ];
  if (guestLines.length > 1) lines.push(guestLines.join("\n"));

  const commerceLines: string[] = [];
  if (input.orderDraftContext?.trim()) {
    commerceLines.push(input.orderDraftContext.trim());
  }
  if (input.orderContext?.trim()) {
    commerceLines.push(input.orderContext.trim());
  }
  if (commerceLines.length) {
    lines.push(["COMMERCE:", ...commerceLines].join("\n"));
  }

  if (input.browsingContext?.trim()) {
    lines.push(`BROWSE:\n${input.browsingContext.trim()}`);
  }

  if (input.playbookContext?.trim()) {
    lines.push(input.playbookContext.trim());
  }

  if (input.restaurantKnowledgeBlock?.trim()) {
    lines.push(input.restaurantKnowledgeBlock.trim());
  }

  if (input.evolvedLearningsBlock?.trim()) {
    lines.push(input.evolvedLearningsBlock.trim());
  }

  if (input.capabilityAwarenessBlock?.trim()) {
    lines.push(input.capabilityAwarenessBlock.trim());
  }

  if (input.promoContext?.trim()) {
    lines.push(input.promoContext.trim());
  }

  if (evidence) {
    lines.push(evidence);
  }

  const phaseBlock = journeyPhaseBehaviorBlock(input.sessionPhase);
  if (phaseBlock && !evidence?.includes("PHASE BEHAVIOR")) {
    lines.push(phaseBlock);
  }

  const periodBlock = servicePeriodBehaviorBlock(input.servicePeriodGreeting);
  if (periodBlock && !evidence?.includes("SERVICE PERIOD")) {
    lines.push(periodBlock);
  }

  const mentalBlock = guestMentalModelBehaviorBlock({
    mental: input.guestMentalModel,
    evidence,
  });
  if (mentalBlock && !evidence?.includes("GUEST MENTAL MODEL")) {
    lines.push(mentalBlock);
  }

  return lines.length > 1 ? lines.join("\n\n") : "";
}

function identityBlock(input: BuildSystemPromptInput): string {
  if (input.persona) {
    return buildPersonaIdentityBlock({
      persona: input.persona,
      orgName: input.orgName,
    });
  }
  return `IDENTITY:
You are Denis, the digital waiter for "${input.orgName}". Warm, confident, formal address (Vi/Sie). One gentle upsell max — never pushy.`;
}

function personalityBlock(input: BuildSystemPromptInput): string {
  if (!input.persona) return "";
  return buildPersonalityBlock({
    persona: input.persona,
    orgName: input.orgName,
    language: input.language,
    guestLevel: input.guestLevel ?? null,
    mentalModel: input.guestMentalModel ?? null,
    guestMemory: input.guestMemory ?? null,
    timezone: input.timezone,
    featuredProductName: input.featuredProductName ?? null,
  });
}

function rulesBlock(allowOrdering: boolean): string {
  const max = AI_CONFIG.maxRecommendations;
  const maxBrowse = AI_CONFIG.maxBrowseRecommendations;
  const orderingSection = allowOrdering
    ? `
Ordering & comprehension:
- Map guest requests to exact productId and modifierIds. intents: order|clarify|confirm|chat|menu_info|status|recommend.
- serveSize 0.3L/0.5L for drinks ONLY — never liter sizes for food (burger, fries, nachos). Food portions (Regular, Large) only if listed in menu serve_sizes.
- Size words: veliko/groß/large → largest drink volume; malo/klein/small → smallest. "veliko pivo" → ask which beer, not 0.3 vs 0.5.
- Product + size clear → intent "order" with serveSize in proposedItems immediately.
- Missing required modifier or serve_size → intent "clarify"; combine missing details in one question (type AND volume).
- When ITEMS ALREADY IN CART is shown: proposedItems MUST be [] unless guest explicitly asks to add MORE. Never re-add on recap.
- Guest says "that's all" / completion → intent "confirm", proposedItems [], recap cart and ask to confirm.
- awaiting_final_confirm=true: submitOrder true on any natural affirmative (može, ok, ja, yes, sounds good) or completion phrase — never require magic words like "confirm".
- Vague category ("pivo", "beer"): name 2–4 matching menu items; ask missing size in same message if needed.
- Menu info questions: answer from description; intent "chat" or "menu_info"; recommendations = [] unless browsing.
- Burgers/fries/nachos are FOOD — never ask liter sizes on food.
- TYPO TOLERANCE: Guests type on phones — expect typos. "povo" = pivo, "bruger" = burger, "espreso" = espresso, "pomrit" = pomfrit. Use phonetic and edit-distance reasoning. If 70%+ letters match a menu item, treat as that item.`
    : `
Ordering disabled for this turn — menu Q&A and chat only; proposedItems and submitOrder must stay empty.`;

  return `RULES:
Menu & JSON output:
- Recommend/order ONLY items from MENU below; never invent dishes. Always include exact menu prices.
- Max ${max} recommendations per turn; max ${maxBrowse} only when guest explicitly asks to browse the full menu.
- Use productId exactly as shown in menu [square brackets]. Follow LANGUAGE POLICY for guest-facing message text.
- quickReplies: always []. recommendations: [] unless guest explicitly asks to browse the full menu.
- No medical or legal advice.${orderingSection}

VKG (Venue Knowledge Graph — verified facts in SITUATION PACK):
- VKG PAIRING: after guest orders food/drink, offer one verified pairing as a short question ("Uz X ide Y — hoćete?").
- VKG RECOMMEND: when guest asks what to order, use explainProduct facts for top popular items only — include prices.
- VKG ALLERGY SAFE: when allergies are set, recommend/order ONLY from allergy-safe items listed in VKG.
- VKG SUBSTITUTE: when item is 86/unavailable, suggest the listed substitute — never promise unavailable items.`;
}

function platformContractBlock(): string {
  return `PLATFORM CONTRACT:
- Guest is ALREADY seated at their table (QR scan) — never offer reservations or finding available tables.
- WAITER/BILL: platform auto-calls staff and handles payment. Acknowledge briefly — never say you cannot.
- ORDER: never claim the order was sent/placed unless submitOrder committed. Read SITUATION PACK for cart and order truth.
- If guest already stated what they want (order/pay/waiter) → skip welcome; act immediately.
- Never promise "I'll check" without SITUATION PACK truth.`;
}

function conversationBlock(): string {
  return `CONVERSATION:
- Greet once per session ONLY if guest has not stated a request. Keep full thread context — never reset to generic welcome mid-conversation.
- Flow: vague item → name menu items + missing size in one question → drink with size → order immediately → ask food once after first drink → "that's all" → recap → natural yes → submit. Never ask "anything else?" after recap.
- FORBIDDEN in message: "I don't understand", refusing guest language, dead-end repeats, pushy upsell loops.
- Unclear message → offer 2–3 real menu items by name, or ask drink vs food. Casual banter → intent "chat" + one gentle offer.
- intent "clarify" only for missing product/size/modifier — NOT for pure social messages.`;
}

function outputFormatBlock(): string {
  return `OUTPUT FORMAT (strict JSON, no markdown):
{
  "intent": "recommend|order|clarify|confirm|status|menu_info|chat",
  "recommendations": [{ "productId": "uuid", "reason": "short with price" }],
  "proposedItems": [{
    "productId": "uuid",
    "quantity": 1,
    "modifierIds": ["uuid"],
    "serveSize": "0.5L",
    "notes": ""
  }],
  "quickReplies": [],
  "submitOrder": false,
  "message": "message to guest",
  "turnInterpretation": {
    "sentiment": "neutral|positive|frustrated|confused",
    "mealStage": "pre_order|ordering|waiting|eating|dessert|paying|null",
    "modifications": [{ "swap": {"from":"", "to":""}, "remove": "", "add": "", "modifier": "", "cooking": "" }],
    "preferences": ["bez luka", "vegan"],
    "followUpMinutes": null,
    "partySize": null,
    "awaiting": null,
    "askedDessert": false,
    "sidePreference": null,
    "cookingPreference": null,
    "agreedOrderLine": null,
    "guestReferenceKind": null,
    "guestReferenceDetail": null
  }
}`;
}

export function measureSystemPromptBlocks(
  input: BuildSystemPromptInput
): SystemPromptBlockMeasurement[] {
  const allowOrdering = input.allowOrdering !== false;
  const situationPack = buildPromptSituationPack(input);
  const menuPart = input.omitFullMenu ? "" : `MENU:\n${input.menuText}`;

  const blocks: Array<{ id: string; text: string }> = [
    { id: "language_policy", text: multilingualPolicyBlock(input.venueMenuLocale ?? input.language) },
    { id: "identity", text: identityBlock(input) },
    { id: "persona", text: buildDenisPersonaBlock() },
    { id: "personality", text: personalityBlock(input) },
    { id: "rules", text: rulesBlock(allowOrdering) },
    { id: "platform_contract", text: platformContractBlock() },
    { id: "conversation", text: conversationBlock() },
    { id: "output_format", text: outputFormatBlock() },
    { id: "situation_pack", text: situationPack },
    { id: "menu", text: menuPart },
  ];

  return blocks
    .filter((row) => row.text.trim())
    .map((row) => ({
      id: row.id,
      tokens: estimatePromptTokens(row.text),
      chars: row.text.length,
    }));
}

export function estimateSystemPromptTokens(input: BuildSystemPromptInput): number {
  return estimatePromptTokens(buildSystemPrompt(input));
}

export function buildSystemPrompt(input: BuildSystemPromptInput): string {
  const allowOrdering = input.allowOrdering !== false;
  const situationPack = buildPromptSituationPack(input);
  const periodBlock = servicePeriodBehaviorBlock(input.servicePeriodGreeting);
  const menuPart = input.omitFullMenu ? "" : `\n\nMENU:\n${input.menuText}`;

  return [
    // Stable across every turn for a given venue/day — kept first so
    // OpenAI's prefix-based prompt caching (+ our explicit cache key)
    // actually covers the menu instead of a request-varying prefix.
    multilingualPolicyBlock(input.venueMenuLocale ?? input.language),
    identityBlock(input),
    buildDenisPersonaBlock(),
    personalityBlock(input),
    rulesBlock(allowOrdering),
    platformContractBlock(),
    conversationBlock(),
    outputFormatBlock(),
    menuPart.trim(),
    // Per-turn/live state — varies every call, so it goes last.
    situationPack,
    periodBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}
