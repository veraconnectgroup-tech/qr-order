/**
 * ADR-053 M3 — resolve a spoken table reference ("spremno za sto dvanaest",
 * "sto pet", "terasa dva") against the location's real tables. Pure, no
 * I/O — same conservative posture as resolve-spoken-product.ts: ambiguity
 * comes back as candidates for Denis to read back, never a silent guess,
 * because sending a runner to the wrong table is a real-world mistake.
 *
 * Serbian trap handled explicitly: "sto" means both "table" and "hundred".
 * In this domain it's always the table word ("za sto dvanaest"), so it's
 * stripped as a filler before number conversion — table numbers in a
 * restaurant don't reach 100.
 */

export type SpokenTableCandidate = {
  id: string;
  name: string;
};

export type SpokenTableResolution =
  | { kind: "match"; table: SpokenTableCandidate }
  | { kind: "ambiguous"; candidates: SpokenTableCandidate[] }
  | { kind: "none" };

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalize(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const UNITS: Record<string, number> = {
  nula: 0,
  jedan: 1,
  jedna: 1,
  jedno: 1,
  dva: 2,
  dve: 2,
  tri: 3,
  cetiri: 4,
  pet: 5,
  sest: 6,
  sedam: 7,
  osam: 8,
  devet: 9,
};

const TEENS: Record<string, number> = {
  deset: 10,
  jedanaest: 11,
  dvanaest: 12,
  trinaest: 13,
  cetrnaest: 14,
  petnaest: 15,
  sesnaest: 16,
  sedamnaest: 17,
  osamnaest: 18,
  devetnaest: 19,
};

const TENS: Record<string, number> = {
  dvadeset: 20,
  trideset: 30,
  cetrdeset: 40,
  pedeset: 50,
  sezdeset: 60,
  sedamdeset: 70,
  osamdeset: 80,
  devedeset: 90,
};

/** Words that reference the table itself, not its identity — dropped before matching. */
const TABLE_FILLER_WORDS = ["sto", "stolu", "stola", "broj", "za", "na"] as const;

/**
 * Converts Serbian number words in a token stream to digits, merging
 * "dvadeset pet" -> "25". Non-number tokens pass through untouched.
 */
export function serbianNumberWordsToDigits(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token in TEENS) {
      out.push(String(TEENS[token]));
      continue;
    }
    if (token in TENS) {
      const next = tokens[i + 1];
      if (next && next in UNITS && UNITS[next]! > 0) {
        out.push(String(TENS[token]! + UNITS[next]!));
        i += 1;
      } else {
        out.push(String(TENS[token]));
      }
      continue;
    }
    if (token in UNITS) {
      out.push(String(UNITS[token]));
      continue;
    }
    out.push(token);
  }
  return out;
}

/** Normalized, number-converted, filler-free token list for one side of the match. */
function toMatchTokens(raw: string): string[] {
  const tokens = normalize(raw)
    .split(" ")
    .filter(
      (token) =>
        token && !(TABLE_FILLER_WORDS as readonly string[]).includes(token)
    );
  return serbianNumberWordsToDigits(tokens);
}

export function resolveSpokenTable(
  spokenRef: string,
  tables: SpokenTableCandidate[]
): SpokenTableResolution {
  const spokenTokens = toMatchTokens(spokenRef);
  if (spokenTokens.length === 0) return { kind: "none" };
  const spokenJoined = spokenTokens.join(" ");

  const scored = tables
    .map((table) => {
      const nameTokens = toMatchTokens(table.name);
      const nameJoined = nameTokens.join(" ");
      if (!nameJoined) return { table, score: 0 };
      if (nameJoined === spokenJoined) return { table, score: 1 };
      // Every token of the table's identity spoken, in any order —
      // "terasa dva" matches "2 Terasa" too.
      const spokenSet = new Set(spokenTokens);
      if (
        nameTokens.length > 0 &&
        nameTokens.every((token) => spokenSet.has(token))
      ) {
        return { table, score: 0.9 };
      }
      // Spoken ref fully contained in the name ("dva" for "Terasa 2") —
      // weaker: several tables can share the token, ambiguity sorts it out.
      const nameSet = new Set(nameTokens);
      if (spokenTokens.every((token) => nameSet.has(token))) {
        return { table, score: 0.7 };
      }
      return { table, score: 0 };
    })
    .filter((entry) => entry.score >= 0.7)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: "none" };

  const best = scored[0]!;
  const rivals = scored
    .slice(1)
    .filter((entry) => best.score - entry.score < 0.15);

  if (rivals.length > 0) {
    return {
      kind: "ambiguous",
      candidates: [best, ...rivals].slice(0, 3).map((entry) => entry.table),
    };
  }

  return { kind: "match", table: best.table };
}
