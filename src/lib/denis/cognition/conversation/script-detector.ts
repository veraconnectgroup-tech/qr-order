export type GuestScript = "latin" | "cyrillic" | "arabic" | "other";

export type ScriptDetectionResult = {
  inputScript: GuestScript;
  responseScript: "latin" | "cyrillic";
  /** Latin transliteration for downstream token matching when input is Cyrillic. */
  normalizedLatinText: string;
  mixedScript: boolean;
};

const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;
const ARABIC_PATTERN = /[\u0600-\u06FF]/;
const LATIN_PATTERN = /[A-Za-z\u0100-\u024F\u1E00-\u1EFF]/;

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  ђ: "đ",
  е: "e",
  ж: "ž",
  з: "z",
  и: "i",
  ј: "j",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  њ: "nj",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  ћ: "ć",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "č",
  џ: "dž",
  ш: "š",
  љ: "lj",
  А: "A",
  Б: "B",
  В: "V",
  Г: "G",
  Д: "D",
  Ђ: "Đ",
  Е: "E",
  Ж: "Ž",
  З: "Z",
  И: "I",
  Ј: "J",
  К: "K",
  Л: "L",
  М: "M",
  Н: "N",
  Њ: "Nj",
  О: "O",
  П: "P",
  Р: "R",
  С: "S",
  Т: "T",
  Ћ: "Ć",
  У: "U",
  Ф: "F",
  Х: "H",
  Ц: "C",
  Ч: "Č",
  Џ: "Dž",
  Ш: "Š",
  Љ: "Lj",
};

function detectDominantScript(text: string): GuestScript {
  const hasCyrillic = CYRILLIC_PATTERN.test(text);
  const hasArabic = ARABIC_PATTERN.test(text);
  const hasLatin = LATIN_PATTERN.test(text);

  if (hasCyrillic && hasLatin) return "cyrillic";
  if (hasCyrillic) return "cyrillic";
  if (hasArabic && !hasLatin) return "arabic";
  if (hasLatin) return "latin";
  return "other";
}

/** Serbian/Cyrillic → Latin for comprehension while menu stays Latin. */
export function transliterateCyrillicToLatin(text: string): string {
  let output = "";
  for (const char of text) {
    output += CYRILLIC_TO_LATIN[char] ?? char;
  }
  return output;
}

/** Detect guest script and choose response script (menu-driven). */
export function detectGuestScript(
  text: string,
  options?: {
    menuScript?: "latin" | "cyrillic";
    preferredScript?: "latin" | "cyrillic" | null;
  }
): ScriptDetectionResult {
  const trimmed = text.trim();
  const menuScript = options?.menuScript ?? "latin";
  const preferredScript = options?.preferredScript ?? menuScript;

  const hasCyrillic = CYRILLIC_PATTERN.test(trimmed);
  const hasLatin = LATIN_PATTERN.test(trimmed);
  const inputScript = detectDominantScript(trimmed);

  const normalizedLatinText =
    inputScript === "cyrillic"
      ? transliterateCyrillicToLatin(trimmed)
      : trimmed;

  let responseScript: "latin" | "cyrillic" = menuScript;
  if (menuScript === "latin" && inputScript === "cyrillic") {
    responseScript = "latin";
  } else if (preferredScript) {
    responseScript = preferredScript;
  }

  return {
    inputScript,
    responseScript,
    normalizedLatinText,
    mixedScript: hasCyrillic && hasLatin,
  };
}
