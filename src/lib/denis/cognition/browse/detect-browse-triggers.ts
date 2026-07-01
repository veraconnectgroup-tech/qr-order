import {
  BROWSE_CATEGORY_NUDGE_MIN_MS,
  BROWSE_CATEGORY_NUDGE_MIN_PRODUCTS,
  BROWSE_PRODUCT_FOLLOW_UP_MS,
} from "@/lib/denis/cognition/browse/browse-constants";
import {
  categoryPopularPick,
  resolveCategoryLabel,
} from "@/lib/denis/cognition/browse/classify-browse-domain";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";

export type CategoryBrowseNudgeTrigger = {
  kind: "browse_nudge";
  categoryId: string;
  categoryLabel: string;
  message: string;
  prompt?: string;
};

export type BrowseProductFollowUpTrigger = {
  kind: "browse_follow_up";
  productId: string;
  productName: string;
  message: string;
};

export type CategoryInterestTrigger = {
  kind: "browse_nudge";
  menuSection: "desserts";
  message: string;
};

function normalizeLang(language?: string | null): "sr" | "de" | "en" {
  const lang = (language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "de") return "de";
  if (lang === "en") return "en";
  return "sr";
}

function localizeCategoryLabel(categoryLabel: string, language: "sr" | "de" | "en"): string {
  if (language === "sr") {
    const key = categoryLabel.toLowerCase();
    if (key === "salads" || key === "salad") return "salate";
    if (key === "desserts" || key === "dessert") return "deserte";
    if (key === "burgers" || key === "burger") return "burgere";
  }
  return categoryLabel;
}

export function buildCategoryBrowseNudgeMessage(input: {
  categoryLabel: string;
  popularPick: string;
  language?: string | null;
}): string {
  const lang = normalizeLang(input.language);
  const category = localizeCategoryLabel(input.categoryLabel, lang);
  const pick = input.popularPick;

  if (lang === "de") {
    return `Ich sehe, Sie schauen sich ${category} an — unsere ${pick} ist am beliebtesten!`;
  }
  if (lang === "en") {
    return `I see you're browsing ${category} — our ${pick} is the most popular!`;
  }
  return `Vidim da gledate ${category} — naša ${pick} je najpopularnija!`;
}

export function buildBrowseProductFollowUpMessage(input: {
  productName: string;
  language?: string | null;
}): string {
  const lang = normalizeLang(input.language);
  const name = input.productName.trim();

  if (lang === "de") {
    return `Interessiert Sie ${name} noch? Ich beantworte gern Fragen.`;
  }
  if (lang === "en") {
    return `Still interested in ${name}? Happy to answer any questions.`;
  }
  return `Još uvek vas zanima ${name}? Mogu odgovoriti na pitanja.`;
}

export function buildDessertCategoryInterestMessage(language?: string | null): string {
  const lang = normalizeLang(language);
  if (lang === "de") {
    return "Unsere Desserts sind ein Hit — Tiramisu ist die beste Wahl.";
  }
  if (lang === "en") {
    return "Our desserts are a hit — Tiramisu is the best pick.";
  }
  return "Naši deserti su hit — Tiramisu je najbolji izbor.";
}

function categoryBrowseSpanMs(
  focus: GuestBrowseProfile["categoryFocus"][0],
  profile: GuestBrowseProfile
): number {
  const start = Date.parse(focus.firstViewedAt);
  const end = Date.parse(focus.lastViewedAt);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return end - start;
  }
  return profile.totalBrowseMs;
}

/** 3+ products in same category, 3+ min browsing, no order yet. */
export function detectCategoryBrowseNudge(input: {
  browse: GuestBrowseProfile;
  hasOrdered: boolean;
  language?: string | null;
  nowMs?: number;
}): CategoryBrowseNudgeTrigger | null {
  if (input.hasOrdered || !input.browse.categoryFocus.length) return null;

  const sessionStart = input.browse.sessionStartedAt
    ? Date.parse(input.browse.sessionStartedAt)
    : NaN;
  const nowMs = input.nowMs ?? Date.now();
  const sessionAgeMs =
    Number.isFinite(sessionStart) && sessionStart > 0
      ? nowMs - sessionStart
      : input.browse.totalBrowseMs;

  if (sessionAgeMs < BROWSE_CATEGORY_NUDGE_MIN_MS) return null;

  const focus = input.browse.categoryFocus.find(
    (row) =>
      row.uniqueProductCount >= BROWSE_CATEGORY_NUDGE_MIN_PRODUCTS &&
      categoryBrowseSpanMs(row, input.browse) >= BROWSE_CATEGORY_NUDGE_MIN_MS
  );
  if (!focus) return null;

  const popularPick = categoryPopularPick(focus.categoryLabel, focus.menuSection);
  const message = buildCategoryBrowseNudgeMessage({
    categoryLabel: focus.categoryLabel,
    popularPick,
    language: input.language,
  });

  return {
    kind: "browse_nudge",
    categoryId: focus.categoryId,
    categoryLabel: focus.categoryLabel,
    message,
    prompt: `Guest browsed ${focus.uniqueProductCount} items in ${focus.categoryLabel} — suggest ${popularPick}.`,
  };
}

/** Guest viewed product, left detail, 5+ min without ordering. */
export function detectBrowseProductFollowUp(input: {
  browse: GuestBrowseProfile;
  hasOrdered: boolean;
  language?: string | null;
  nowMs?: number;
}): BrowseProductFollowUpTrigger | null {
  if (input.hasOrdered) return null;

  const product = input.browse.topFollowUpProduct;
  if (!product?.lastViewedAt) return null;
  if (product.disposition === "abandoned") return null;

  const viewedAt = Date.parse(product.lastViewedAt);
  if (!Number.isFinite(viewedAt)) return null;

  const nowMs = input.nowMs ?? Date.now();
  if (nowMs - viewedAt < BROWSE_PRODUCT_FOLLOW_UP_MS) return null;

  return {
    kind: "browse_follow_up",
    productId: product.productId,
    productName: product.productName,
    message: buildBrowseProductFollowUpMessage({
      productName: product.productName,
      language: input.language,
    }),
  };
}

/** Heavy dessert browsing without order — category interest nudge. */
export function detectDessertCategoryInterest(input: {
  browse: GuestBrowseProfile;
  hasOrdered: boolean;
  language?: string | null;
}): CategoryInterestTrigger | null {
  if (input.hasOrdered || !input.browse.browsedDesserts) return null;

  const dessertViews = input.browse.viewedProducts.filter((row) =>
    row.categoryPath.some((part) => /dessert|sweet|cake|tiramisu/i.test(part))
  );
  if (dessertViews.length < 2) return null;

  const totalDwell = dessertViews.reduce((sum, row) => sum + row.totalDwellMs, 0);
  if (totalDwell < 4_000) return null;

  return {
    kind: "browse_nudge",
    menuSection: "desserts",
    message: buildDessertCategoryInterestMessage(input.language),
  };
}

/** Resolve display label for situation pack. */
export function summarizeBrowseCategoryFocus(
  browse: GuestBrowseProfile | null | undefined
): string | null {
  const focus = browse?.categoryFocus?.[0];
  if (!focus) return null;
  return resolveCategoryLabel([focus.categoryLabel], focus.categoryLabel);
}
