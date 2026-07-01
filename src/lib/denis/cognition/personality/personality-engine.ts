import type { ConciergePersona, ConciergeTone } from "@/lib/denis/config/concierge-config.schema";
import type { GuestLevelId } from "@/lib/denis/commerce/loyalty/guest-level";
import { buildDenisToneGuide, resolveGuestLevel } from "@/lib/denis/commerce/loyalty/guest-level";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import {
  buildCulturalSensitivityBlock,
  resolveCulturalProfile,
} from "@/lib/denis/cognition/personality/cultural-sensitivity";
import {
  buildHumorGuidanceBlock,
  isHumorAllowed,
} from "@/lib/denis/cognition/personality/humor-engine";

export type DayPeriod = "morning" | "afternoon" | "evening" | "late";

export type PersonalityEngineInput = {
  persona: ConciergePersona;
  orgName: string;
  language: string;
  guestLevel?: GuestLevelId | null;
  mentalModel?: GuestMentalModel | null;
  guestMemory?: GuestMemoryProjection | null;
  now?: Date;
  timezone?: string;
  featuredProductName?: string | null;
};

const BASE_PERSONALITY = [
  "BASE PERSONALITY:",
  "- Denis is approachable, smart, and never pushy.",
  "- One gentle suggestion max — service first, sales second.",
  "- Never break character as a human waiter; no AI disclaimers.",
].join("\n");

const TONE_GUIDANCE: Record<ConciergeTone, string> = {
  warm_short:
    "VENUE TONE (warm_short): Warm and concise — friendly Vi/Sie, short sentences, one clear next step.",
  formal:
    "VENUE TONE (formal): Professional and precise — formal address, complete sentences, no slang, no emoji.",
  playful_luxury:
    "VENUE TONE (playful_luxury): Boutique luxury — confident, lightly witty, elevated vocabulary, subtle charm.",
  efficient:
    "VENUE TONE (efficient): Fast and clear — minimal words, direct questions, zero filler.",
};

const GREETING_STYLE_GUIDANCE: Record<
  ConciergePersona["greetingStyle"],
  string
> = {
  offer_drink_or_food:
    "GREETING: Offer a drink or starter once at welcome — not on every turn.",
  welcome_only: "GREETING: Brief welcome only — let the guest lead.",
  venue_story:
    "GREETING: One sentence of venue character at welcome — then menu focus.",
};

const TIME_ADAPTATION: Record<DayPeriod, string> = {
  morning:
    "TIME (morning): Quieter energy — coffee/brunch tone, no late-night bar talk.",
  afternoon:
    "TIME (afternoon): Balanced — lunch specials OK, moderate upsell.",
  evening:
    "TIME (evening): Livelier — aperitif/dinner suggestions welcome, warmer banter.",
  late:
    "TIME (late): Calm wrap-up — last orders, bill-friendly, no heavy food push.",
};

export function resolveDayPeriod(
  now: Date = new Date(),
  timezone?: string
): DayPeriod {
  let hour = now.getUTCHours();
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).formatToParts(now);
      const hourPart = parts.find((p) => p.type === "hour")?.value;
      if (hourPart) hour = Number(hourPart);
    } catch {
      /* fall back to UTC */
    }
  }

  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "late";
}

export function buildEmotionalIntelligenceBlock(input: {
  mentalModel?: GuestMentalModel | null;
  persona: ConciergePersona;
}): string | null {
  const affect = input.mentalModel?.affect;
  const pace = input.mentalModel?.pace;
  const receptiveness = input.mentalModel?.receptiveness;
  const frustration = affect?.frustration.level ?? "none";
  const sentiment = affect?.sentiment.score ?? 0;

  const lines: string[] = [];

  if (frustration === "high" || frustration === "mild") {
    lines.push(
      "EMOTIONAL STATE (frustrated guest):",
      "- Apologize briefly and sincerely — no excuses or fake ETAs.",
      "- Become concise and service-focused; zero upsell or banter.",
      "- Acknowledge the issue, offer one concrete next step."
    );
  } else if (sentiment >= 0.6 || receptiveness === "enthusiastic") {
    lines.push(
      "EMOTIONAL STATE (happy guest):",
      "- Match their energy — slightly more conversational.",
      "- OK to suggest pairings or a second round when natural.",
      "- Still one suggestion max; never stack offers."
    );
  } else if (
    pace === "indecisive" ||
    input.mentalModel?.predictedNeed === "needs_help_choosing"
  ) {
    lines.push(
      "EMOTIONAL STATE (undecided guest):",
      "- Ask clarifying questions — help them choose, do not push.",
      "- Offer 2–3 real menu options with short reasons.",
      "- No urgency language; patience over conversion."
    );
  } else if (receptiveness === "closed" || receptiveness === "polite_decline") {
    lines.push(
      "EMOTIONAL STATE (declining guest):",
      "- Respect the no — service-only tone, no further suggestions."
    );
  }

  if (!lines.length) return null;
  return lines.join("\n");
}

export function buildGuestLevelAdaptationBlock(
  guestLevel?: GuestLevelId | null
): string | null {
  if (!guestLevel) return null;
  const level = resolveGuestLevel({
    visitCount: guestLevel === 1 ? 1 : guestLevel === 2 ? 3 : guestLevel === 3 ? 7 : 15,
    totalSpent: guestLevel >= 3 ? 200 : 0,
  });
  return ["GUEST ADAPTATION:", `- ${buildDenisToneGuide(level)}`].join("\n");
}

export function buildSessionMemoryBlock(input: {
  guestMemory?: GuestMemoryProjection | null;
  language: string;
  featuredProductName?: string | null;
}): string | null {
  const memory = input.guestMemory;
  if (!memory || memory.visitCount < 2) return null;

  const lines: string[] = ["SESSION MEMORY (return guest — use naturally once):"];
  const lang = input.language.slice(0, 2);

  const favorites = [
    ...(memory.favoriteItems ?? []),
    ...(memory.lastVisitItemNames ?? []),
  ]
    .filter(Boolean)
    .slice(0, 3);

  if (favorites.length > 0) {
    const items = favorites.join(", ");
    if (lang === "de") {
      lines.push(
        `- Beim letzten Mal: ${items} — erwähnen wenn passend, nicht aufdringlich.`
      );
    } else if (lang === "en") {
      lines.push(
        `- Last visit they enjoyed ${items} — reference once if relevant.`
      );
    } else {
      lines.push(
        `- Prošli put su uživali u ${items} — spomeni jednom ako je prirodno.`
      );
    }
  }

  if (memory.mood === "frustrated" || memory.lastFeedbackSentiment === "negative") {
    lines.push("- Prior visit had friction — extra care and patience today.");
  }

  const wineHint = favorites.find((item) =>
    /riesling|wine|vino|wein/i.test(item)
  );
  if (wineHint && input.featuredProductName) {
    lines.push(
      `- Memory hook: "Last time you liked ${wineHint} — today we have ${input.featuredProductName}!" (only if true on menu).`
    );
  }

  return lines.length > 1 ? lines.join("\n") : null;
}

export function buildPersonaIdentityBlock(input: {
  persona: ConciergePersona;
  orgName: string;
}): string {
  const { persona, orgName } = input;
  const emojiRule = persona.emoji
    ? "- Emoji: at most one per message when playful_luxury tone."
    : "- Emoji: never use emoji in replies.";

  const forbidden =
    persona.forbiddenPhrases.length > 0
      ? `- Forbidden phrases (never say): ${persona.forbiddenPhrases.map((p) => `"${p}"`).join(", ")}`
      : null;

  return [
    "IDENTITY:",
    `You are ${persona.name}, ${persona.role} for "${orgName}".`,
    `- Max ${persona.maxWordsPerReply} words per reply.`,
    emojiRule,
    forbidden,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPersonalityBlock(input: PersonalityEngineInput): string {
  const period = resolveDayPeriod(input.now, input.timezone);
  const cultural = resolveCulturalProfile(input.language, input.persona.tone);

  const sections = [
    BASE_PERSONALITY,
    TONE_GUIDANCE[input.persona.tone],
    GREETING_STYLE_GUIDANCE[input.persona.greetingStyle],
    TIME_ADAPTATION[period],
    buildCulturalSensitivityBlock(cultural),
    buildGuestLevelAdaptationBlock(input.guestLevel),
    buildEmotionalIntelligenceBlock({
      mentalModel: input.mentalModel,
      persona: input.persona,
    }),
    buildSessionMemoryBlock({
      guestMemory: input.guestMemory,
      language: input.language,
      featuredProductName: input.featuredProductName,
    }),
    isHumorAllowed(input.persona.tone, input.mentalModel)
      ? buildHumorGuidanceBlock({
          tone: input.persona.tone,
          language: input.language,
          productName: input.featuredProductName,
          forbiddenPhrases: input.persona.forbiddenPhrases,
        })
      : null,
  ].filter(Boolean);

  return sections.join("\n\n");
}

/** Manifest / playbook overlay — tone hint for venue packs. */
export function buildManifestPersonalityOverlay(
  persona: ConciergePersona,
  packPlaybook?: string | null
): string | null {
  const lines = [
    "PERSONA MANIFEST:",
    `- Active tone: ${persona.tone}`,
    `- Role: ${persona.role}`,
  ];
  if (packPlaybook?.trim()) {
    lines.push(`- Playbook alignment: follow venue playbook tone without contradicting ${persona.tone}.`);
  }
  return lines.join("\n");
}
