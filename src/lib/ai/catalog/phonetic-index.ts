import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";

function normalizePhoneticInput(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Z]/g, "");
}

/** American Soundex — compact phonetic fingerprint. */
export function soundex(value: string): string {
  const input = normalizePhoneticInput(value);
  if (!input) return "";

  const first = input[0]!;
  const map: Record<string, string> = {
    B: "1",
    F: "1",
    P: "1",
    V: "1",
    C: "2",
    G: "2",
    J: "2",
    K: "2",
    Q: "2",
    S: "2",
    X: "2",
    Z: "2",
    D: "3",
    T: "3",
    L: "4",
    M: "5",
    N: "5",
    R: "6",
  };

  let code = first;
  let previous = map[first] ?? "";

  for (let index = 1; index < input.length; index += 1) {
    const char = input[index]!;
    const digit = map[char] ?? "";
    if (!digit || digit === previous) continue;
    code += digit;
    previous = digit;
    if (code.length >= 4) break;
  }

  return code.padEnd(4, "0").slice(0, 4);
}

export type PhoneticIndex = {
  byCode: Map<string, string[]>;
  byProductId: Map<string, string>;
};

export function buildPhoneticIndex(
  catalog: Record<string, AiCatalogProduct>
): PhoneticIndex {
  const byCode = new Map<string, string[]>();
  const byProductId = new Map<string, string>();

  for (const product of Object.values(catalog)) {
    const words = product.name.split(/\s+/).filter((word) => word.length >= 3);
    const primary = words[0] ?? product.name;
    const code = soundex(primary);
    byProductId.set(product.id, code);

    const bucket = byCode.get(code) ?? [];
    if (!bucket.includes(product.id)) {
      bucket.push(product.id);
      byCode.set(code, bucket);
    }

    for (const word of words.slice(1)) {
      const wordCode = soundex(word);
      const wordBucket = byCode.get(wordCode) ?? [];
      if (!wordBucket.includes(product.id)) {
        wordBucket.push(product.id);
        byCode.set(wordCode, wordBucket);
      }
    }
  }

  return { byCode, byProductId };
}

export function findPhoneticProductIds(
  token: string,
  index: PhoneticIndex
): string[] {
  const code = soundex(token);
  return index.byCode.get(code) ?? [];
}

export function phoneticMatchScore(token: string, candidate: string): number {
  return soundex(token) === soundex(candidate) && token.length >= 3 ? 0.8 : 0;
}
