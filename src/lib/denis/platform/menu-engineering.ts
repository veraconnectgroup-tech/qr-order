export const MIN_MENU_ENGINEERING_DAYS = 30;

export type MenuEngineeringCategory = "star" | "puzzle" | "workhorse" | "dog";

export type MenuSeason = "summer" | "winter" | "shoulder";

export type MenuEngineeringProduct = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  menuSection?: string | null;
};

export type MenuEngineeringOrderRow = {
  productId: string;
  productName: string;
  quantity: number;
  revenueCents: number;
};

export type MenuItemAnalysis = {
  productId: string;
  name: string;
  category: MenuEngineeringCategory;
  orderCount: number;
  revenueCents: number;
  avgRating: number | null;
  suggestion: string;
  price: number;
};

export type MenuEngineeringInsight = {
  lookbackDays: number;
  hasEnoughData: boolean;
  medianVolume: number;
  medianPrice: number;
  items: MenuItemAnalysis[];
  byCategory: Record<MenuEngineeringCategory, MenuItemAnalysis[]>;
  revenueImpact: MenuEngineeringRevenueImpact | null;
  seasonal: MenuEngineeringSeasonalHint | null;
};

export type MenuEngineeringRevenueImpact = {
  weeklyDeltaCents: number;
  dogsRemoved: number;
  starsAdded: number;
  summaryLine: string;
};

export type MenuEngineeringSeasonalHint = {
  season: MenuSeason;
  headline: string;
  lines: string[];
};

const SUGGESTION_SR: Record<MenuEngineeringCategory, string> = {
  star: "Nastavi promovirati",
  puzzle: "Denis nudi kao nudge",
  workhorse: "Razmisli o paketu",
  dog: "Kandidat za uklanjanje",
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/** BCG quadrant for a single menu item (K2). */
export function classifyMenuEngineeringItem(input: {
  orderCount: number;
  price: number;
  medianVolume: number;
  medianPrice: number;
}): MenuEngineeringCategory {
  return classifyItem(input);
}

function classifyItem(input: {
  orderCount: number;
  price: number;
  medianVolume: number;
  medianPrice: number;
}): MenuEngineeringCategory {
  const highVolume = input.orderCount >= input.medianVolume;
  const highMargin = input.price >= input.medianPrice;
  if (highVolume && highMargin) return "star";
  if (!highVolume && highMargin) return "puzzle";
  if (highVolume && !highMargin) return "workhorse";
  return "dog";
}

function groupByCategory(
  items: MenuItemAnalysis[]
): Record<MenuEngineeringCategory, MenuItemAnalysis[]> {
  return {
    star: items.filter((item) => item.category === "star"),
    puzzle: items.filter((item) => item.category === "puzzle"),
    workhorse: items.filter((item) => item.category === "workhorse"),
    dog: items.filter((item) => item.category === "dog"),
  };
}

/** BCG-style menu matrix — price as margin proxy when COGS unavailable (K2). */
export function analyzeMenu(input: {
  products: MenuEngineeringProduct[];
  orderHistory: MenuEngineeringOrderRow[];
  lookbackDays: number;
  ratingsByProductId?: Record<string, number>;
}): MenuEngineeringInsight {
  const lookbackDays = Math.max(1, input.lookbackDays);
  const hasEnoughData = lookbackDays >= MIN_MENU_ENGINEERING_DAYS;

  const orderByProduct = new Map<
    string,
    { orderCount: number; revenueCents: number; name: string }
  >();

  for (const row of input.orderHistory) {
    const existing = orderByProduct.get(row.productId);
    if (existing) {
      existing.orderCount += row.quantity;
      existing.revenueCents += row.revenueCents;
    } else {
      orderByProduct.set(row.productId, {
        orderCount: row.quantity,
        revenueCents: row.revenueCents,
        name: row.productName,
      });
    }
  }

  const availableProducts = input.products.filter((product) => product.isAvailable);
  const prices = availableProducts.map((product) => product.price).filter((p) => p > 0);
  const medianPrice = median(prices);

  const volumeSamples = availableProducts.map(
    (product) => orderByProduct.get(product.id)?.orderCount ?? 0
  );
  const medianVolume = Math.max(1, median(volumeSamples.filter((v) => v > 0)) || 1);

  const items: MenuItemAnalysis[] = availableProducts.map((product) => {
    const stats = orderByProduct.get(product.id);
    const orderCount = stats?.orderCount ?? 0;
    const category = classifyItem({
      orderCount,
      price: product.price,
      medianVolume,
      medianPrice,
    });

    return {
      productId: product.id,
      name: product.name,
      category,
      orderCount,
      revenueCents: stats?.revenueCents ?? 0,
      avgRating: input.ratingsByProductId?.[product.id] ?? null,
      suggestion: SUGGESTION_SR[category],
      price: product.price,
    };
  });

  items.sort((a, b) => b.orderCount - a.orderCount || b.revenueCents - a.revenueCents);

  const revenueImpact = hasEnoughData
    ? simulateMenuEngineeringRevenueImpact({
        insight: {
          lookbackDays,
          hasEnoughData,
          medianVolume,
          medianPrice,
          items,
          byCategory: groupByCategory(items),
          revenueImpact: null,
          seasonal: null,
        },
      })
    : null;

  const seasonal = hasEnoughData
    ? detectSeasonalMenuShift({
        items,
        orderHistory: input.orderHistory,
        products: availableProducts,
      })
    : null;

  return {
    lookbackDays,
    hasEnoughData,
    medianVolume,
    medianPrice,
    items,
    byCategory: groupByCategory(items),
    revenueImpact,
    seasonal,
  };
}

export function menuEngineeringCategoryMap(
  insight: MenuEngineeringInsight
): Record<string, MenuEngineeringCategory> {
  const map: Record<string, MenuEngineeringCategory> = {};
  for (const item of insight.items) {
    map[item.productId] = item.category;
  }
  return map;
}

export function isMenuEngineeringBlocked(
  category: MenuEngineeringCategory | undefined
): boolean {
  return category === "dog";
}

export function menuEngineeringScoreMultiplier(
  category: MenuEngineeringCategory | undefined
): number {
  if (category === "dog") return 0;
  if (category === "puzzle") return 1.25;
  if (category === "star") return 1.2;
  if (category === "workhorse") return 0.95;
  return 1;
}

/** Puzzle-item proactive copy — "Jeste li probali…?" (K2). */
export function buildPuzzleNudgeMessage(
  productName: string,
  language = "sr"
): string {
  const name = productName.trim() || "specijalitet";
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `Haben Sie schon unseren ${name} probiert?`;
  }
  if (lang === "en") {
    return `Have you tried our ${name} yet?`;
  }
  return `Jeste li probali naš ${name}?`;
}

export function resolveMenuSeason(month: number): MenuSeason {
  if (month >= 6 && month <= 8) return "summer";
  if (month === 12 || month <= 2) return "winter";
  return "shoulder";
}

function isSaladLike(name: string, menuSection?: string | null): boolean {
  const haystack = `${name} ${menuSection ?? ""}`.toLowerCase();
  return /salat|salad|zelena|bowl|cezar|caesar/.test(haystack);
}

function isSoupLike(name: string, menuSection?: string | null): boolean {
  const haystack = `${name} ${menuSection ?? ""}`.toLowerCase();
  return /sup|soup|čorba|corba|krem/.test(haystack);
}

/** Seasonal popularity shift — summer salads vs winter soups (K2). */
export function detectSeasonalMenuShift(input: {
  items: MenuItemAnalysis[];
  orderHistory: MenuEngineeringOrderRow[];
  products: MenuEngineeringProduct[];
  nowMs?: number;
}): MenuEngineeringSeasonalHint | null {
  const nowMs = input.nowMs ?? Date.now();
  const season = resolveMenuSeason(new Date(nowMs).getUTCMonth() + 1);
  if (season === "shoulder") return null;

  const productMeta = new Map(
    input.products.map((product) => [
      product.id,
      { name: product.name, menuSection: product.menuSection ?? null },
    ])
  );

  const volumeByProduct = new Map<string, number>();
  for (const row of input.orderHistory) {
    volumeByProduct.set(
      row.productId,
      (volumeByProduct.get(row.productId) ?? 0) + row.quantity
    );
  }

  const saladStars: string[] = [];
  const soupStars: string[] = [];
  const saladDogs: string[] = [];
  const soupDogs: string[] = [];

  for (const item of input.items) {
    const meta = productMeta.get(item.productId);
    if (!meta) continue;
    if (isSaladLike(meta.name, meta.menuSection)) {
      if (item.category === "star") saladStars.push(item.name);
      if (item.category === "dog") saladDogs.push(item.name);
    }
    if (isSoupLike(meta.name, meta.menuSection)) {
      if (item.category === "star") soupStars.push(item.name);
      if (item.category === "dog") soupDogs.push(item.name);
    }
  }

  const lines: string[] = [];
  if (season === "summer") {
    if (saladStars.length) {
      lines.push(`Leto: ${saladStars.slice(0, 2).join(", ")} su star — Denis boostuje.`);
    }
    if (soupDogs.length) {
      lines.push(`Leto: ${soupDogs.slice(0, 2).join(", ")} su dog — smanji fokus.`);
    }
  } else {
    if (soupStars.length) {
      lines.push(`Zima: ${soupStars.slice(0, 2).join(", ")} su star — Denis boostuje.`);
    }
    if (saladDogs.length) {
      lines.push(`Zima: ${saladDogs.slice(0, 2).join(", ")} su dog — smanji fokus.`);
    }
  }

  if (!lines.length) return null;

  return {
    season,
    headline:
      season === "summer"
        ? "Sezonski meni — letnji profil"
        : "Sezonski meni — zimski profil",
    lines,
  };
}

/** What-if: remove dogs, promote one star (K2). */
export function simulateMenuEngineeringRevenueImpact(input: {
  insight: MenuEngineeringInsight;
  dogsToRemove?: number;
  starsToPromote?: number;
}): MenuEngineeringRevenueImpact {
  const dogs = input.insight.byCategory.dog.filter((item) => item.orderCount > 0);
  const stars = input.insight.byCategory.star;
  const removeCount = Math.min(
    input.dogsToRemove ?? Math.min(3, dogs.length),
    dogs.length
  );
  const promoteCount = Math.min(input.starsToPromote ?? 1, stars.length);

  const lostWeeklyCents = dogs
    .slice(0, removeCount)
    .reduce((sum, item) => sum + Math.round(item.revenueCents / 4.3), 0);

  const gainedWeeklyCents = stars.slice(0, promoteCount).reduce((sum, item) => {
    const weeklyBase = item.revenueCents / 4.3;
    return sum + Math.round(weeklyBase * 0.15);
  }, 0);

  const weeklyDeltaCents = Math.round(gainedWeeklyCents - lostWeeklyCents * 0.35);
  const weeklyEuros = Math.round(Math.abs(weeklyDeltaCents) / 100);
  const sign = weeklyDeltaCents >= 0 ? "+" : "−";

  return {
    weeklyDeltaCents,
    dogsRemoved: removeCount,
    starsAdded: promoteCount,
    summaryLine:
      removeCount > 0 && promoteCount > 0
        ? `Ako uklonite ${removeCount} dog itema i dodate ${promoteCount} star: est. ${sign}€${weeklyEuros}/ned`
        : `Procena uticaja: ${sign}€${weeklyEuros}/ned`,
  };
}

const DIGEST_EMOJI: Record<MenuEngineeringCategory, string> = {
  star: "⭐",
  puzzle: "🧩",
  workhorse: "🐂",
  dog: "🐕",
};

const DIGEST_LABEL: Record<MenuEngineeringCategory, string> = {
  star: "Stars",
  puzzle: "Puzzles",
  workhorse: "Workhorses",
  dog: "Dogs",
};

function formatMoneyMajor(revenueCents: number): string {
  return `${Math.round(revenueCents / 100).toLocaleString("sr-RS")} RSD`;
}

function formatDigestLine(item: MenuItemAnalysis): string {
  return `${item.name} (${item.orderCount} narudžbi, ${formatMoneyMajor(item.revenueCents)}) — ${item.suggestion}`;
}

export function pickStarPopularityPair(input: {
  products: Array<{ id: string; name: string }>;
  categories: Record<string, MenuEngineeringCategory>;
  cartProductIds?: string[];
}): { from: string; to: string } | null {
  const stars = input.products.filter(
    (product) => input.categories[product.id] === "star"
  );
  if (!stars.length) return null;

  const cartIds = input.cartProductIds ?? [];
  const cartStar = stars.find((star) => cartIds.includes(star.id));
  const topStar = stars[0]!;
  const secondStar = stars[1];

  if (cartStar && secondStar && cartStar.id !== secondStar.id) {
    return { from: cartStar.name, to: secondStar.name };
  }
  if (secondStar) {
    return { from: topStar.name, to: secondStar.name };
  }
  return { from: topStar.name, to: topStar.name };
}

export function pickMenuEngineeringDessert(input: {
  desserts: Array<{ id: string; name: string }>;
  categories: Record<string, MenuEngineeringCategory>;
}): string | null {
  const puzzle = input.desserts.find(
    (item) => input.categories[item.id] === "puzzle"
  );
  if (puzzle) return puzzle.name;
  return input.desserts[0]?.name ?? null;
}

/** Owner-facing digest lines (K2). */
export function formatMenuEngineeringDigestLines(
  insight: MenuEngineeringInsight,
  limitPerCategory = 2
): string[] {
  if (!insight.hasEnoughData) {
    return [
      `Meni analiza zahteva minimum ${MIN_MENU_ENGINEERING_DAYS} dana podataka.`,
    ];
  }

  const lines: string[] = [];
  for (const category of ["star", "puzzle", "workhorse", "dog"] as const) {
    const rows = insight.byCategory[category]
      .filter((item) => item.orderCount > 0 || category === "dog")
      .slice(0, limitPerCategory);
    if (!rows.length) continue;
    lines.push(
      `${DIGEST_EMOJI[category]} ${DIGEST_LABEL[category]}: ${rows
        .map(formatDigestLine)
        .join("; ")}`
    );
  }

  return lines;
}
