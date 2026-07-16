/**
 * ADR-053 P2 — resolve a spoken product name ("skini lososa") against the
 * location's real catalog. Pure string matching, no I/O: the voice tool's
 * propose step loads candidates and calls this, so the match rule is
 * directly unit-testable. Deliberately conservative — an ambiguous or
 * weak match returns candidates for Denis to read back and re-ask, never
 * a silent best guess (mishearing "losos" as "osmica" in a loud kitchen
 * must surface, not execute).
 */

export type SpokenProductCandidate = {
  id: string;
  name: string;
};

export type SpokenProductResolution =
  | { kind: "match"; product: SpokenProductCandidate }
  | { kind: "ambiguous"; candidates: SpokenProductCandidate[] }
  | { kind: "none" };

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeSpokenProductName(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Serbian spoken forms inflect ("lososa" for "losos") — compare on a crude stem. */
function stemToken(token: string): string {
  if (token.length <= 4) return token;
  return token.slice(0, Math.max(4, token.length - 2));
}

function tokenOverlapScore(spokenTokens: string[], nameTokens: string[]): number {
  if (spokenTokens.length === 0 || nameTokens.length === 0) return 0;
  const nameStems = new Set(nameTokens.map(stemToken));
  let hits = 0;
  for (const token of spokenTokens) {
    if (nameStems.has(stemToken(token))) hits += 1;
  }
  // Coverage of what was SPOKEN, not of the full menu name — a cook says
  // "lososa", never the dish's full "Losos sa gril povrćem"; dividing by
  // the name's word count would reject exactly the common shorthand case.
  return hits / spokenTokens.length;
}

function scoreCandidate(spoken: string, name: string): number {
  const normalizedName = normalizeSpokenProductName(name);
  if (!normalizedName) return 0;
  if (normalizedName === spoken) return 1;
  if (normalizedName.startsWith(spoken) || spoken.startsWith(normalizedName)) {
    return 0.9;
  }
  if (normalizedName.includes(spoken) || spoken.includes(normalizedName)) {
    return 0.8;
  }
  return tokenOverlapScore(spoken.split(" "), normalizedName.split(" ")) * 0.75;
}

const MATCH_THRESHOLD = 0.55;
const AMBIGUITY_GAP = 0.15;
const MAX_AMBIGUOUS_CANDIDATES = 3;

export function resolveSpokenProduct(
  spokenName: string,
  candidates: SpokenProductCandidate[]
): SpokenProductResolution {
  const spoken = normalizeSpokenProductName(spokenName);
  if (!spoken) return { kind: "none" };

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(spoken, candidate.name),
    }))
    .filter((entry) => entry.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: "none" };

  const best = scored[0]!;
  const runnersUp = scored
    .slice(1)
    .filter((entry) => best.score - entry.score < AMBIGUITY_GAP);

  if (runnersUp.length > 0) {
    return {
      kind: "ambiguous",
      candidates: [best, ...runnersUp]
        .slice(0, MAX_AMBIGUOUS_CANDIDATES)
        .map((entry) => entry.candidate),
    };
  }

  return { kind: "match", product: best.candidate };
}
