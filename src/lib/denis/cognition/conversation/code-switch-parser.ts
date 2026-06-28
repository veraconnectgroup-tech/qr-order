import type { AI_SUPPORTED_LANGUAGES } from "@/lib/ai/config";

export type SupportedGuestLanguage = (typeof AI_SUPPORTED_LANGUAGES)[number];

export type CodeSwitchSegment = {
  language: SupportedGuestLanguage | "unknown";
  text: string;
};

export type CodeSwitchDialect = "sr" | "hr" | "bs" | null;

export type CodeSwitchParseResult = {
  segments: CodeSwitchSegment[];
  dominantLanguage: SupportedGuestLanguage;
  responseLanguage: SupportedGuestLanguage;
  menuItemHints: string[];
  casualMode: boolean;
  dialect: CodeSwitchDialect;
  codeSwitched: boolean;
};

type WordClass = SupportedGuestLanguage | "menu" | "neutral";

const CASUAL_SLANG_PATTERN = /\b(bre|ba|brate|legendo|legend|ćao|cao|ej|alo)\b/i;

const HR_DIALECT_PATTERN = /\b(kaj|sto\b|idete|idete|kak)\b/i;
const SR_DIALECT_PATTERN = /\b(šta|sta\b|bre|brate|ba\b|dva|tri|pivo|piva)\b/i;

const GERMAN_WORDS =
  /\b(ein|eine|einen|einem|einer|und|zwei|drei|vier|der|die|das|den|dem|des|mit|bitte|danke|ich|wir|sie|haben|ist|sind|gern|gerne|noch|auch|oder|aber|für|vom|zum|zur|mal|schon|sehr|guten|tag|abend|morgen|kellner|rechnung|bestellen|wasser|wein|kaffee|tee|cola|bier|pils|schnitzel|bratwurst|currywurst|kartoffel|salat|suppe|käse|kase|fleisch|gemüse|gemuse|dessert|nachtisch)\b/i;

const ENGLISH_WORDS =
  /\b(please|thanks|thank|you|the|and|or|a|an|i|we|want|would|like|could|can|have|get|me|my|one|two|three|beer|beers|water|wine|coffee|tea|cola|burger|fries|salad|dessert|order|menu|hello|hi|yes|no)\b/i;

const BALKAN_WORDS =
  /\b(daj|mi|mi\b|molim|hvala|naru[čc]|poru[čc]|donesi|donij|jedn[auo]|dva|tri|pivo|piva|cola|kola|šta|sta|kaj|kako|gde|gdje|imate|imam|ho[ćc]u|hocu|mo[žz]e|moze|želim|zelim|samo|jo[sš]|sve|nema|bre|brate|ba)\b/i;

const MENU_ITEM_PATTERN =
  /\b(Schnitzel|Wiener|Bratwurst|Currywurst|Ćevap[ić]?|Cevap[ić]?|Pilsner|Lager|Weizen|Radler|Greifswalder|Žujela|Zujela|Burger|Pizza|Pasta|Risotto|Tiramisu|Schnitzel|Goulash|Spätzle|Spatzle|Käsespätzle|Kasespatzle)\b/i;

const NUMBER_WITH_NOUN =
  /\b(dva|tri|jedn[auo]|zwei|three|two|one|1|2|3)\s+(pivo|piva|beer|beers|bier|biere|cola|kola|wasser)\b/i;

function classifyWord(word: string): WordClass {
  const token = word.trim();
  if (!token) return "neutral";

  if (MENU_ITEM_PATTERN.test(token)) return "menu";
  if (/^[A-ZÄÖÜ][a-zäöüß]+/.test(token) && token.length >= 4) return "menu";

  if (HR_DIALECT_PATTERN.test(token)) return "hr";
  if (/[äöüßÄÖÜ]/.test(token) || GERMAN_WORDS.test(token)) return "de";
  if (ENGLISH_WORDS.test(token)) return "en";
  if (/[šđčćžŠĐČĆŽ]/.test(token) || BALKAN_WORDS.test(token)) {
    if (HR_DIALECT_PATTERN.test(token)) return "hr";
    return "sr";
  }
  if (BALKAN_WORDS.test(token)) return "sr";

  return "neutral";
}

function mergeSegments(
  parts: Array<{ language: WordClass; text: string }>
): CodeSwitchSegment[] {
  const merged: CodeSwitchSegment[] = [];

  for (const part of parts) {
    const lang =
      part.language === "menu" || part.language === "neutral"
        ? "unknown"
        : part.language;

    const last = merged[merged.length - 1];
    if (last && last.language === lang) {
      last.text = `${last.text} ${part.text}`.trim();
      continue;
    }

    merged.push({ language: lang, text: part.text });
  }

  return merged.filter((row) => row.text.trim().length > 0);
}

function detectDialect(text: string, venueLanguage: string): CodeSwitchDialect {
  const lower = text.toLowerCase();
  if (HR_DIALECT_PATTERN.test(lower)) return "hr";
  if (SR_DIALECT_PATTERN.test(lower)) return "sr";
  if (BALKAN_WORDS.test(lower)) {
    if (venueLanguage === "hr") return "hr";
    if (venueLanguage === "sr" || venueLanguage === "bs") {
      return venueLanguage as CodeSwitchDialect;
    }
  }
  return null;
}

function matchGlobal(pattern: RegExp, text: string): RegExpMatchArray[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))];
}

function extractMenuItemHints(text: string): string[] {
  const hints = new Set<string>();

  for (const match of matchGlobal(MENU_ITEM_PATTERN, text)) {
    hints.add(match[0]!);
  }

  for (const match of matchGlobal(NUMBER_WITH_NOUN, text)) {
    hints.add(match[0]!);
  }

  const capitalized = text.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? [];
  for (const word of capitalized) {
    if (!GERMAN_WORDS.test(word) && !ENGLISH_WORDS.test(word)) {
      hints.add(word);
    }
  }

  return [...hints];
}

function dominantFromSegments(
  segments: CodeSwitchSegment[],
  fallback: SupportedGuestLanguage
): SupportedGuestLanguage {
  const scores = new Map<SupportedGuestLanguage, number>();

  for (const segment of segments) {
    if (segment.language === "unknown") continue;
    scores.set(segment.language, (scores.get(segment.language) ?? 0) + segment.text.length);
  }

  let best: SupportedGuestLanguage = fallback;
  let bestScore = 0;
  for (const [lang, score] of scores) {
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }

  return best;
}

/** Parse mixed-language guest utterances into segments + menu hints. */
export function parseCodeSwitchedMessage(
  message: string,
  options?: {
    venueLanguage?: string;
    fallbackLanguage?: SupportedGuestLanguage;
  }
): CodeSwitchParseResult {
  const text = message.trim();
  const fallback =
    options?.fallbackLanguage ??
    ((options?.venueLanguage?.trim().toLowerCase().slice(0, 2) as SupportedGuestLanguage) ||
      "en");

  if (!text) {
    return {
      segments: [],
      dominantLanguage: fallback,
      responseLanguage: fallback,
      menuItemHints: [],
      casualMode: false,
      dialect: null,
      codeSwitched: false,
    };
  }

  const words = text.split(/\s+/).filter(Boolean);
  const classified = words.map((word) => ({
    language: classifyWord(word),
    text: word,
  }));

  const segments = mergeSegments(classified);
  const languagesUsed = new Set(
    segments.map((row) => row.language).filter((row) => row !== "unknown")
  );

  const segmentDominant = dominantFromSegments(segments, fallback);
  const dialect = detectDialect(text, options?.venueLanguage ?? fallback);
  const dominantLanguage: SupportedGuestLanguage =
    dialect === "hr"
      ? "hr"
      : dialect === "sr" || dialect === "bs"
        ? "sr"
        : segmentDominant;
  const responseLanguage = dominantLanguage;

  return {
    segments,
    dominantLanguage,
    responseLanguage,
    menuItemHints: extractMenuItemHints(text),
    casualMode: CASUAL_SLANG_PATTERN.test(text),
    dialect,
    codeSwitched: languagesUsed.size > 1,
  };
}

export type LanguagePersistenceState = {
  lockedLanguage: SupportedGuestLanguage | null;
  confidence: number;
  sameLanguageTurns: number;
  preferredScript: "latin" | "cyrillic";
};

export function createLanguagePersistenceState(
  overrides: Partial<LanguagePersistenceState> = {}
): LanguagePersistenceState {
  return {
    lockedLanguage: null,
    confidence: 0,
    sameLanguageTurns: 0,
    preferredScript: "latin",
    ...overrides,
  };
}

const EXPLICIT_LANGUAGE_SWITCH =
  /\b(serbisch|serbian|srpski|na srpskom|auf deutsch|in english|in german|nur deutsch|only english|hrvatski|na hrvatskom|auf kroatisch|continue in english|continue in german)\b/i;

/** Stick guest language unless they explicitly switch; 0.9 confidence after 2 same-language turns. */
export function advanceLanguagePersistence(input: {
  detectedLanguage: SupportedGuestLanguage;
  prior: LanguagePersistenceState | null;
  message: string;
  script: "latin" | "cyrillic";
}): LanguagePersistenceState {
  const prior = input.prior ?? createLanguagePersistenceState();
  const explicitSwitch = EXPLICIT_LANGUAGE_SWITCH.test(input.message);

  if (explicitSwitch) {
    return {
      lockedLanguage: input.detectedLanguage,
      confidence: 0.95,
      sameLanguageTurns: 1,
      preferredScript: input.script,
    };
  }

  if (
    prior.lockedLanguage &&
    prior.confidence >= 0.9 &&
    prior.lockedLanguage !== input.detectedLanguage &&
    !explicitSwitch
  ) {
    return {
      ...prior,
      sameLanguageTurns: prior.sameLanguageTurns + 1,
      preferredScript: input.script,
    };
  }

  const sameLanguage =
    prior.lockedLanguage === input.detectedLanguage ||
    prior.lockedLanguage === null;
  const sameLanguageTurns = sameLanguage ? prior.sameLanguageTurns + 1 : 1;
  const lockedLanguage = sameLanguage
    ? input.detectedLanguage
    : input.detectedLanguage;

  const confidence =
    sameLanguageTurns >= 2 ? Math.max(0.9, prior.confidence) : Math.min(0.75, 0.45 + sameLanguageTurns * 0.2);

  return {
    lockedLanguage,
    confidence,
    sameLanguageTurns,
    preferredScript: input.script,
  };
}

export function resolvePersistentResponseLanguage(input: {
  detectedLanguage: SupportedGuestLanguage;
  persistence: LanguagePersistenceState;
}): SupportedGuestLanguage {
  if (
    input.persistence.lockedLanguage &&
    input.persistence.confidence >= 0.9
  ) {
    return input.persistence.lockedLanguage;
  }
  return input.detectedLanguage;
}
