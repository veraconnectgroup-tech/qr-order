export type TypoCorrectionEntry = {
  typo: string;
  productId: string;
  productName: string;
  confidence: number;
  learnedAt: string;
};

export type TypoCorrectionMap = Map<string, TypoCorrectionEntry>;

function normalizeTypo(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function buildTypoCorrectionMap(
  entries: TypoCorrectionEntry[] = []
): TypoCorrectionMap {
  const map: TypoCorrectionMap = new Map();
  for (const entry of entries) {
    map.set(normalizeTypo(entry.typo), entry);
  }
  return map;
}

export function learnTypoCorrection(
  map: TypoCorrectionMap,
  input: {
    typo: string;
    productId: string;
    productName: string;
  }
): TypoCorrectionMap {
  const next = new Map(map);
  next.set(normalizeTypo(input.typo), {
    typo: input.typo,
    productId: input.productId,
    productName: input.productName,
    confidence: 1,
    learnedAt: new Date().toISOString(),
  });
  return next;
}

export function lookupLearnedTypoCorrection(
  map: TypoCorrectionMap | undefined,
  query: string
): TypoCorrectionEntry | null {
  if (!map?.size) return null;
  const normalized = normalizeTypo(query);
  return map.get(normalized) ?? null;
}

export function applyTypoCorrectionToQuery(
  map: TypoCorrectionMap | undefined,
  token: string
): TypoCorrectionEntry | null {
  return lookupLearnedTypoCorrection(map, token);
}

/** Guest confirmed Denis clarification — persist for venue. */
export function recordTypoCorrectionFromGuestConfirm(input: {
  guestTypo: string;
  confirmedProductId: string;
  confirmedProductName: string;
  priorMap?: TypoCorrectionMap;
}): TypoCorrectionMap {
  return learnTypoCorrection(input.priorMap ?? buildTypoCorrectionMap(), {
    typo: input.guestTypo,
    productId: input.confirmedProductId,
    productName: input.confirmedProductName,
  });
}
