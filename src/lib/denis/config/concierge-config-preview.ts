import type {
  ConciergeConfig,
  ConciergeGreetingStyle,
  ConciergeTone,
} from "@/lib/denis/config/concierge-config.schema";

export type ConciergePreviewLine = {
  role: "guest" | "assistant";
  text: string;
};

export type ConciergeConfigPreview = {
  headline: string;
  greeting: string;
  sampleReply: string;
  upsellLine: string;
  transcript: ConciergePreviewLine[];
};

type PreviewCopy = {
  headline: string;
  greetings: Record<ConciergeGreetingStyle, string>;
  guestOrder: string;
  replies: Record<ConciergeTone, string>;
  upsell: Record<ConciergeTone, string>;
};

function resolveLang(language?: string): "sr" | "de" | "en" {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

function previewCopy(language?: string): PreviewCopy {
  const lang = resolveLang(language);

  if (lang === "de") {
    return {
      headline: "So würde Denis sprechen",
      greetings: {
        offer_drink_or_food:
          "Guten Tag! Möchten Sie etwas zu trinken oder etwas zu essen?",
        welcome_only: "Willkommen — ich bin Denis, Ihr Tisch-Concierge.",
        venue_story:
          "Schön, dass Sie da sind. Wir servieren heute frische saisonale Gerichte — womit darf ich starten?",
      },
      guestOrder: "Ein Helles und die Vorspeise, bitte.",
      replies: {
        warm_short: "Sehr gern — ein Helles und die Vorspeise. Passt das so?",
        formal:
          "Selbstverständlich. Ich notiere ein Helles und die Vorspeise für Ihren Tisch.",
        playful_luxury:
          "Ausgezeichnete Wahl — ein kühles Helles und unsere Vorspeise kommen gleich.",
        efficient: "Helles und Vorspeise — bestätigt.",
      },
      upsell: {
        warm_short: "Dazu passt unser hausgemachter Dip — soll ich ihn dazulegen?",
        formal:
          "Darf ich Ihnen unseren hausgemachten Dip als Ergänzung empfehlen?",
        playful_luxury:
          "Der Dip ist heute ein Geheimtipp — perfekt zum Teilen.",
        efficient: "Empfehlung: hausgemachter Dip dazu.",
      },
    };
  }

  if (lang === "en") {
    return {
      headline: "How Denis would speak",
      greetings: {
        offer_drink_or_food: "Good evening! Something to drink or to eat?",
        welcome_only: "Welcome — I'm Denis, your table concierge.",
        venue_story:
          "Great to have you here. Tonight we're featuring seasonal dishes — where shall we start?",
      },
      guestOrder: "A lager and the starter, please.",
      replies: {
        warm_short: "Of course — one lager and the starter. Shall I send that?",
        formal:
          "Certainly. I will note one lager and the starter for your table.",
        playful_luxury:
          "Lovely choice — a crisp lager and our starter are on their way.",
        efficient: "Lager and starter — confirmed.",
      },
      upsell: {
        warm_short: "Our house dip pairs well — want me to add it?",
        formal: "May I suggest our house dip as a complement?",
        playful_luxury: "The house dip is tonight's quiet star — perfect for sharing.",
        efficient: "Suggestion: add house dip.",
      },
    };
  }

  return {
    headline: "Ovako bi Denis pričao",
    greetings: {
      offer_drink_or_food: "Dobar dan! Želite li nešto za piće ili nešto za jelo?",
      welcome_only: "Dobrodošli — ja sam Denis, vaš konobar za sto.",
      venue_story:
        "Drago nam je što ste ovde. Večeras ističemo sezonska jela — odakle krećemo?",
    },
    guestOrder: "Jedno pivo i predjelo, molim.",
    replies: {
      warm_short: "Naravno — jedno pivo i predjelo. Da pošaljem?",
      formal:
        "Razumem. Beležim jedno pivo i predjelo za vaš sto.",
      playful_luxury:
        "Odličan izbor — hladno pivo i predjelo stižu uskoro.",
      efficient: "Pivo i predjelo — potvrđeno.",
    },
    upsell: {
      warm_short: "Uz to ide naš domaći dip — da dodam?",
      formal: "Dozvolite da predložim domaći dip kao prilog.",
      playful_luxury: "Domaći dip je večerašnji mali luksuz — savršen za deljenje.",
      efficient: "Preporuka: domaći dip.",
    },
  };
}

function trimToMaxWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

/** Deterministic preview — no LLM, instant on tone/greeting edits. */
export function buildConciergeConfigPreview(
  config: Pick<ConciergeConfig, "persona" | "language">
): ConciergeConfigPreview {
  const copy = previewCopy(config.language.venueDefault);
  const tone = config.persona.tone;
  const greetingStyle = config.persona.greetingStyle;
  const name = config.persona.name.trim() || "Denis";

  let greeting = copy.greetings[greetingStyle];
  if (config.persona.emoji && !greeting.includes("✨")) {
    greeting = `${greeting} ✨`;
  }

  const sampleReply = trimToMaxWords(
    copy.replies[tone].replace(/\bDenis\b/g, name),
    config.persona.maxWordsPerReply
  );
  const upsellLine = trimToMaxWords(copy.upsell[tone], config.persona.maxWordsPerReply);

  return {
    headline: copy.headline,
    greeting: greeting.replace(/\bDenis\b/g, name),
    sampleReply,
    upsellLine,
    transcript: [
      { role: "assistant", text: greeting.replace(/\bDenis\b/g, name) },
      { role: "guest", text: copy.guestOrder },
      { role: "assistant", text: sampleReply },
      { role: "assistant", text: upsellLine },
    ],
  };
}
