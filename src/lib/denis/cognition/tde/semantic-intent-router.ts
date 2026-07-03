import intentClustersJson from "@/lib/denis/cognition/tde/intent-clusters.json";

/** Semantic guest-message intent clusters (T1 embedding router). */
export type GuestSemanticCluster =
  | "order"
  | "browse"
  | "smalltalk"
  | "complaint"
  | "status"
  | "handoff"
  | "settling"
  | "reorder"
  | "preorder"
  | "promo_inquiry"
  | "round"
  | "price_inquiry"
  | "modification"
  | "copy_order"
  | "still_browsing";

/** T0 deterministic intents — 100% confidence, 0ms. */
export type GuestDeterministicIntent =
  | "confirm"
  | "decline"
  | "clarify_reply";

export type GuestRoutedIntent = GuestSemanticCluster | GuestDeterministicIntent;

export type IntentRouteTier = "T0" | "T1" | "T2";

export type SemanticIntentResult = {
  intent: GuestRoutedIntent;
  tier: IntentRouteTier;
  /** 0–1 confidence; T0 = 1, T1 = cosine score, T2 = 0 */
  confidence: number;
  cluster?: GuestSemanticCluster;
  /** Normalized cache key when cache was used */
  cacheKey?: string;
};

export type SemanticIntentCacheOptions = {
  maxSize?: number;
};

type IntentClusterFile = {
  version: number;
  dim: number;
  clusters: Record<
    string,
    {
      examples: string[];
      exampleVectors: number[][];
      centroid: number[];
    }
  >;
};

const CLUSTER_DATA = intentClustersJson as IntentClusterFile;

/** Minimum cosine score to accept T1 classification (else T2 / LLM). */
const T1_MIN_CONFIDENCE = 0.35;

/** Best cluster must beat runner-up by this margin. */
const T1_MIN_MARGIN = 0.04;

const T0_CONFIRM =
  /^(da|ja|yes|yep|ok+|potvrdi|confirm|pošalji|posalji|send|bestellen|naruči|naruci)([\s,.!]|$)/i;

const T0_DECLINE =
  /^(ne+hvala|ne hvala|ne, hvala|ne treba|nein danke|no thanks?|nope|ne[.!]?)([\s,.!]|$)/i;

const T0_CLARIFY_REPLY = /^\d{1,2}$/;

const T0_MENU_AVAILABILITY =
  /^(imate li|imaju li|da li imate|do you have)\s+(?!.*\b(popust\w*|discount|rabatt|promo|akcij\w*|gutschein|coupon)\b).+/i;

const T0_PROMO_INQUIRY =
  /\b(popust\w*|discount|rabatt|promo code|promocij\w*|akcij\w*|gutschein|coupon)\b/i;

const LOCAL_EMBED_DIM = 96;

const INTENT_SEMANTIC_EXPANSIONS: Record<string, readonly string[]> = {
  lagano: ["lagana", "light", "leicht", "salata", "salad", "supa", "soup"],
  lagana: ["lagano", "light", "leicht", "salata", "salad"],
  light: ["lagano", "lagana", "salad", "salata"],
  teško: ["teški", "heavy", "burger", "steak", "jelo"],
  teški: ["teško", "heavy", "burger", "steak"],
  bez: ["free", "frei", "without", "no"],
  glutena: ["gluten", "glutenfree", "glutenfrei"],
  pivo: ["beer", "lager", "pilsner", "radler", "ale"],
  vegan: ["plant", "biljno", "vegetarijanski"],
};

function normalizeMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function expandIntentTokens(tokens: string[]): string[] {
  const expanded: string[] = [];
  for (const token of tokens) {
    if (!expanded.includes(token)) expanded.push(token);
    for (const alias of INTENT_SEMANTIC_EXPANSIONS[token] ?? []) {
      if (!expanded.includes(alias)) expanded.push(alias);
    }
  }
  return expanded;
}

function tokenizeIntentText(value: string): string[] {
  const tokens = normalizeMessage(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
  return expandIntentTokens(tokens);
}

function buildIntentEmbedText(query: string): string {
  return tokenizeIntentText(query).join(" ");
}

function hashIntentToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (magnitude <= 0) return values;
  return values.map((value) => value / magnitude);
}

function embedIntentTextLocal(text: string): number[] {
  const vec = new Array<number>(LOCAL_EMBED_DIM).fill(0);
  for (const token of tokenizeIntentText(text)) {
    const hash = hashIntentToken(token);
    for (let i = 0; i < LOCAL_EMBED_DIM; i++) {
      const sign = (hash >> (i % 32)) & 1 ? 1 : -1;
      vec[i] += sign;
    }
  }
  return normalizeVector(vec);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i]! * b[i]!;
  }
  return dot;
}

function classifyT0(message: string): SemanticIntentResult | null {
  const text = normalizeMessage(message);
  if (!text) return null;

  if (T0_CONFIRM.test(text)) {
    return { intent: "confirm", tier: "T0", confidence: 1 };
  }
  if (T0_DECLINE.test(text)) {
    return { intent: "decline", tier: "T0", confidence: 1 };
  }
  if (T0_CLARIFY_REPLY.test(text)) {
    return { intent: "clarify_reply", tier: "T0", confidence: 1 };
  }
  if (T0_PROMO_INQUIRY.test(text)) {
    return { intent: "promo_inquiry", tier: "T0", confidence: 1 };
  }
  if (T0_MENU_AVAILABILITY.test(text)) {
    return { intent: "order", tier: "T0", confidence: 1 };
  }
  return null;
}

function embedGuestMessage(message: string): number[] {
  return embedIntentTextLocal(buildIntentEmbedText(message));
}

function classifyT1(message: string): SemanticIntentResult | null {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 280) return null;

  const query = embedGuestMessage(trimmed);
  let bestCluster: GuestSemanticCluster | null = null;
  let bestScore = -1;
  let secondScore = -1;

  for (const [name, cluster] of Object.entries(CLUSTER_DATA.clusters)) {
    const clusterName = name as GuestSemanticCluster;
    let clusterBest = -1;
    for (const vector of cluster.exampleVectors) {
      const score = cosineSimilarity(query, vector);
      if (score > clusterBest) clusterBest = score;
    }
    const centroidScore = cosineSimilarity(query, cluster.centroid);
    clusterBest = Math.max(clusterBest, centroidScore);

    if (clusterBest > bestScore) {
      secondScore = bestScore;
      bestScore = clusterBest;
      bestCluster = clusterName;
    } else if (clusterBest > secondScore) {
      secondScore = clusterBest;
    }
  }

  if (
    !bestCluster ||
    bestScore < T1_MIN_CONFIDENCE ||
    bestScore - secondScore < T1_MIN_MARGIN
  ) {
    return null;
  }

  return {
    intent: bestCluster,
    tier: "T1",
    confidence: bestScore,
    cluster: bestCluster,
  };
}

/** Per-request or eval LRU cache — not module-global (serverless-safe). */
export class SemanticIntentCache {
  private readonly maxSize: number;
  private readonly store = new Map<string, SemanticIntentResult>();
  private readonly order: string[] = [];

  constructor(options: SemanticIntentCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
  }

  get(key: string): SemanticIntentResult | undefined {
    const normalized = normalizeMessage(key);
    const hit = this.store.get(normalized);
    if (!hit) return undefined;
    const idx = this.order.indexOf(normalized);
    if (idx >= 0) {
      this.order.splice(idx, 1);
      this.order.push(normalized);
    }
    return hit;
  }

  set(key: string, value: SemanticIntentResult): void {
    const normalized = normalizeMessage(key);
    if (this.store.has(normalized)) {
      this.store.set(normalized, value);
      const idx = this.order.indexOf(normalized);
      if (idx >= 0) {
        this.order.splice(idx, 1);
        this.order.push(normalized);
      }
      return;
    }
    while (this.order.length >= this.maxSize) {
      const evict = this.order.shift();
      if (evict) this.store.delete(evict);
    }
    this.order.push(normalized);
    this.store.set(normalized, { ...value, cacheKey: normalized });
  }

  get size(): number {
    return this.store.size;
  }
}

export type ClassifyGuestIntentOptions = {
  cache?: SemanticIntentCache;
  /** Force T2 unknown — for tests / LLM fallback path */
  skipT1?: boolean;
};

/**
 * 2-layer intent router: T0 deterministic → T1 embeddings → T2 (caller uses LLM).
 */
export function classifyGuestIntent(
  message: string,
  options: ClassifyGuestIntentOptions = {}
): SemanticIntentResult {
  const trimmed = message.trim();
  if (!trimmed) {
    return { intent: "smalltalk", tier: "T2", confidence: 0 };
  }

  const cacheKey = normalizeMessage(trimmed);
  if (options.cache) {
    const cached = options.cache.get(trimmed);
    if (cached) {
      return { ...cached, cacheKey, tier: cached.tier };
    }
  }

  const t0 = classifyT0(trimmed);
  if (t0) {
    options.cache?.set(trimmed, t0);
    return t0;
  }

  if (!options.skipT1) {
    const t1 = classifyT1(trimmed);
    if (t1) {
      options.cache?.set(trimmed, t1);
      return t1;
    }
  }

  const fallback: SemanticIntentResult = {
    intent: "smalltalk",
    tier: "T2",
    confidence: 0,
    cluster: "smalltalk",
  };
  options.cache?.set(trimmed, fallback);
  return fallback;
}

/** Self-improving hook — append misclassified phrase to cluster at runtime (eval/dev). */
export function suggestClusterExample(
  cluster: GuestSemanticCluster,
  phrase: string
): { cluster: GuestSemanticCluster; phrase: string; vector: number[] } {
  return {
    cluster,
    phrase: phrase.trim(),
    vector: embedGuestMessage(phrase),
  };
}

// ─── Legacy regex classifier (A/B eval baseline) ─────────────────────────────

const REGEX_SETTLING =
  /\b(hvala|danke|thanks|that's all|to je sve|fertig|zaplat|pay|rechnung bitte|that's it|done ordering|ajde racun|ajde račun|racun molim|račun molim)\b/i;

const REGEX_STATUS =
  /\b(kad sti[žz]e|kada sti[žz]e|gde je|gdje je|where.*order|wo ist|when.*(arriv|ready|coming)|order status|status.*order|moje pivo|my beer|jesi\s+(poslao|poslala|poslali)|da\s+li\s+(ste|si)\s+posl|poslao\s+porud[žz]bin|poslata|poslat[aoe]?|nisam\s+dobio|nisi\s+dobio|nije\s+stiglo|not\s+(sent|received|arrived)|keine\s+bestellung|da\s+li\s+ste\s+saznal)\b/i;

const REGEX_COMPLAINT =
  /\b(nisi poslao|nije poslat|not sent|keine bestellung|order.*not.*(sent|received)|waiter says|konobar ka[žz]e|nisam dobio|nisi dobio|nije stiglo|gde je pivo|gdje je pivo)\b/i;

const REGEX_BROWSE =
  /\b(preporu[čc]|empfehl|recommend|suggest|šta da|sta da|was (soll|empfehl)|what should|surprise me|izaberi|odaberi|sta imate|šta imate|what do you have|ma daj)\b/i;

const REGEX_ORDER =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|weizen|pilsner|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|schnitzel|pils|espresso|latte|molim|bitte|please|ho[ćc]u|želim|zelim|jedno|jedna|malo|veliko|daj mi)\b/i;

export function classifyGuestIntentRegex(message: string): GuestRoutedIntent {
  const text = message.trim();
  if (!text) return "smalltalk";

  const normalized = normalizeMessage(text);
  if (T0_CONFIRM.test(normalized)) return "confirm";
  if (T0_DECLINE.test(normalized)) return "decline";
  if (T0_CLARIFY_REPLY.test(normalized)) return "clarify_reply";

  if (REGEX_SETTLING.test(text)) return "settling";
  if (REGEX_COMPLAINT.test(text)) return "complaint";
  if (REGEX_STATUS.test(text)) return "status";
  if (REGEX_BROWSE.test(text)) return "browse";
  if (REGEX_ORDER.test(text)) return "order";
  if (/\b(konobar|kellner|waiter|garson)\b/i.test(text)) return "handoff";

  return "smalltalk";
}

// ─── Routing helpers (replace regex gates in decide-turn-plan) ───────────────

export function isGuestSettlingMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "settling";
}

const BARE_ORDER_PRODUCT =
  /^(pivo|beer|bier|cola|kola|pilsner|weizen|espresso|latte|pils|burger|pizza|schnitzel)$/i;

export function isGuestStatusQueryMessage(message: string): boolean {
  const text = message.trim();
  if (!text || BARE_ORDER_PRODUCT.test(text)) return false;
  if (classifyGuestIntent(text).intent === "status") return true;
  return classifyGuestIntentRegex(text) === "status";
}

export function isGuestOrderComplaintMessage(message: string): boolean {
  return classifyGuestIntentRegex(message.trim()) === "complaint";
}

export function isGuestVagueBrowseMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "browse";
}

export function isGuestOrderIntentMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "order";
}

export function isGuestSmalltalkMessage(message: string): boolean {
  const result = classifyGuestIntent(message);
  return result.intent === "smalltalk" && result.tier !== "T0";
}

export function isGuestHandoffMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "handoff";
}

export function isGuestReorderMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "reorder";
}

export function isGuestPreorderMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "preorder";
}

export function isGuestPromoInquiryMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "promo_inquiry";
}

export function isGuestRoundMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "round";
}

export function isGuestPriceInquiryMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "price_inquiry";
}

export function isGuestModificationMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "modification";
}

export function isGuestCopyOrderMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "copy_order";
}

export function isGuestDeclineMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "decline";
}

export function isGuestStillBrowsingMessage(message: string): boolean {
  return classifyGuestIntent(message).intent === "still_browsing";
}

export function isGuestComplaintMessage(message: string): boolean {
  const result = classifyGuestIntent(message);
  return result.intent === "complaint";
}

export function isGuestMenuInquiryMessage(message: string): boolean {
  return isGuestVagueBrowseMessage(message);
}

export function isPureSocialBanterMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 120) return false;
  const result = classifyGuestIntent(text);
  return result.intent === "smalltalk" && result.tier !== "T0";
}

/** Eval-only — social without ordering keywords (replaces isCasualSocialGuestMessage). */
export function isCasualSocialGuestMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  const intent = classifyGuestIntent(text).intent;
  return intent === "smalltalk";
}

/** Eval-only — order-line shape (replaces looksLikeOrderLine). */
export function looksLikeOrderLine(message: string): boolean {
  return isGuestOrderIntentMessage(message.trim());
}

export function isVagueRecommendMessage(message: string): boolean {
  return isGuestVagueBrowseMessage(message.trim());
}

export type IntentRouterAbSample = {
  message: string;
  expected: GuestRoutedIntent;
  regexGot: GuestRoutedIntent;
  semanticGot: GuestRoutedIntent;
  regexMatch: boolean;
  semanticMatch: boolean;
  semanticTier: IntentRouteTier;
};

export type IntentRouterAbReport = {
  ok: boolean;
  sampleCount: number;
  regexAccuracy: number;
  semanticAccuracy: number;
  t0Rate: number;
  t1Rate: number;
  t2Rate: number;
  samples: IntentRouterAbSample[];
};

export function runIntentRouterAbEval(
  fixtures: Array<{ message: string; expected: GuestRoutedIntent }>
): IntentRouterAbReport {
  let regexHits = 0;
  let semanticHits = 0;
  let t0 = 0;
  let t1 = 0;
  let t2 = 0;

  const samples: IntentRouterAbSample[] = fixtures.map((row) => {
    const regexGot = classifyGuestIntentRegex(row.message);
    const semantic = classifyGuestIntent(row.message);
    const semanticGot = semantic.intent;
    const regexMatch = regexGot === row.expected;
    const semanticMatch = semanticGot === row.expected;
    if (regexMatch) regexHits++;
    if (semanticMatch) semanticHits++;
    if (semantic.tier === "T0") t0++;
    else if (semantic.tier === "T1") t1++;
    else t2++;

    return {
      message: row.message,
      expected: row.expected,
      regexGot,
      semanticGot,
      regexMatch,
      semanticMatch,
      semanticTier: semantic.tier,
    };
  });

  const n = fixtures.length || 1;
  return {
    ok: semanticHits >= regexHits,
    sampleCount: fixtures.length,
    regexAccuracy: regexHits / n,
    semanticAccuracy: semanticHits / n,
    t0Rate: t0 / n,
    t1Rate: t1 / n,
    t2Rate: t2 / n,
    samples,
  };
}

export const INTENT_ROUTER_AB_FIXTURES: Array<{
  message: string;
  expected: GuestRoutedIntent;
}> = [
  { message: "da", expected: "confirm" },
  { message: "ne", expected: "decline" },
  { message: "2", expected: "clarify_reply" },
  { message: "ma daj", expected: "browse" },
  { message: "ma daj nešto", expected: "browse" },
  { message: "ajde racun", expected: "settling" },
  { message: "rechnung bitte", expected: "settling" },
  { message: "gde si legendo", expected: "smalltalk" },
  { message: "Zdravo kako si", expected: "smalltalk" },
  { message: "daj mi pivo", expected: "order" },
  { message: "1x cola", expected: "order" },
  { message: "kad stiže moje pivo", expected: "status" },
  { message: "nisi poslao", expected: "complaint" },
  { message: "konobar molim", expected: "handoff" },
  { message: "preporuči mi nešto", expected: "browse" },
  { message: "what do you have", expected: "browse" },
  { message: "hvala to je sve", expected: "settling" },
  { message: "Može", expected: "smalltalk" },
  { message: "bestell ein bier", expected: "order" },
  { message: "hallo wie gehts", expected: "smalltalk" },
  { message: "wo ist mein bier", expected: "status" },
  { message: "order not received", expected: "complaint" },
  { message: "kellner bitte", expected: "handoff" },
  { message: "surprise me", expected: "browse" },
  { message: "šta imate?", expected: "browse" },
  { message: "sta ima za pice", expected: "browse" },
  { message: "šta ima za piće", expected: "browse" },
  { message: "sta imate za pice", expected: "browse" },
];
