import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScrollContext } from "@/lib/ai/scroll-context";

export type AiInsightType =
  | "menu_gap"
  | "demand_signal"
  | "conversion"
  | "alert"
  | "feedback_summary";

export type AiInsightSeverity = "info" | "warning" | "critical";

export type AiInsightInsert = {
  org_id: string;
  location_id: string | null;
  type: AiInsightType;
  severity: AiInsightSeverity;
  title: string;
  detail: string;
  metadata: Record<string, unknown>;
  insight_date: string;
};

type SessionRow = {
  id: string;
  org_id: string;
  location_id: string;
  session_token: string;
  messages: Array<{ role: string; content: string }>;
  products_recommended: string[];
  products_added: string[];
  conversion_count: number;
  scroll_context: ScrollContext | null;
  nudges_shown: string[];
  guest_rating: number | null;
  guest_feedback: string | null;
};

type ProductRow = { id: string; name: string; location_id: string };

const MENU_REQUEST =
  /(?:gibt\s+es|habt\s+ihr|haben\s+sie|do\s+you\s+have|is\s+there|könnt\s+ihr|could\s+i\s+get|suche|looking\s+for)/i;
const NOT_AVAILABLE =
  /(?:nicht\s+(?:auf|im)\s+(?:der\s+)?(?:karte|menü|menu)|leider\s+nicht|not\s+(?:on|in)\s+(?:the\s+)?menu|don't\s+have|haben\s+wir\s+nicht)/i;
const STOPWORDS = new Set([
  "aber",
  "also",
  "and",
  "bitte",
  "can",
  "could",
  "das",
  "dem",
  "den",
  "der",
  "die",
  "do",
  "ein",
  "eine",
  "for",
  "gibt",
  "haben",
  "habt",
  "have",
  "ihr",
  "ist",
  "mit",
  "nicht",
  "please",
  "sehr",
  "that",
  "the",
  "und",
  "very",
  "was",
  "what",
  "with",
  "you",
  "your",
]);

function dateRange(insightDate: string) {
  const start = `${insightDate}T00:00:00.000Z`;
  const end = new Date(`${insightDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end: end.toISOString() };
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

function matchesProduct(term: string, productNames: string[]) {
  const needle = normalizeName(term);
  if (!needle) return false;
  return productNames.some(
    (name) =>
      normalizeName(name).includes(needle) ||
      needle.includes(normalizeName(name))
  );
}

function extractGapTerm(userText: string, productNames: string[]) {
  const tokens = userText
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((part) => part.length >= 4);

  for (const token of tokens) {
    if (STOPWORDS.has(token.toLowerCase())) continue;
    if (matchesProduct(token, productNames)) continue;
    return token;
  }

  return userText.slice(0, 80).trim() || null;
}

function countById(ids: string[]) {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

function topThemes(comments: string[]) {
  const freq = new Map<string, number>();
  for (const comment of comments) {
    for (const word of comment.toLowerCase().split(/\s+/)) {
      const token = word.replace(/[^\p{L}\p{N}]/gu, "");
      if (token.length < 4 || STOPWORDS.has(token)) continue;
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));
}

function analyzeLocationSessions(
  orgId: string,
  locationId: string,
  insightDate: string,
  sessions: SessionRow[],
  products: ProductRow[],
  feedbackRows: Array<{ rating: number; comment: string | null }>,
  orderedProductIds: Set<string>
): AiInsightInsert[] {
  const insights: AiInsightInsert[] = [];
  const productNames = products.map((row) => row.name);
  const productNameById = new Map(products.map((row) => [row.id, row.name]));

  const menuGaps = new Map<string, number>();
  for (const session of sessions) {
    for (let i = 0; i < session.messages.length - 1; i++) {
      const user = session.messages[i];
      const assistant = session.messages[i + 1];
      if (user.role !== "user" || assistant?.role !== "assistant") continue;
      if (!MENU_REQUEST.test(user.content) && !NOT_AVAILABLE.test(assistant.content)) {
        continue;
      }
      if (!NOT_AVAILABLE.test(assistant.content)) continue;
      const term = extractGapTerm(user.content, productNames);
      if (!term) continue;
      menuGaps.set(term, (menuGaps.get(term) ?? 0) + 1);
    }
  }

  for (const [term, count] of [...menuGaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    if (count < 1) continue;
    insights.push({
      org_id: orgId,
      location_id: locationId,
      type: "menu_gap",
      severity: count >= 3 ? "warning" : "info",
      title: `Menu gap: "${term}"`,
      detail: `${count} guest${count === 1 ? "" : "s"} asked for something not on the menu.`,
      metadata: { term, count },
      insight_date: insightDate,
    });
  }

  const recommended = countById(sessions.flatMap((row) => row.products_recommended));
  const added = countById(sessions.flatMap((row) => row.products_added));
  const topRecommended = [...recommended.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topRecommended.length) {
    const lines = topRecommended.map(([id, count]) => {
      const name = productNameById.get(id) ?? id.slice(0, 8);
      const addCount = added.get(id) ?? 0;
      return `${name}: ${count} recommended, ${addCount} added`;
    });
    insights.push({
      org_id: orgId,
      location_id: locationId,
      type: "demand_signal",
      severity: "info",
      title: "Top AI recommendations",
      detail: lines.join("; "),
      metadata: {
        recommended: topRecommended.map(([productId, count]) => ({
          productId,
          count,
          added: added.get(productId) ?? 0,
        })),
      },
      insight_date: insightDate,
    });
  }

  const recTotal = sessions.reduce((sum, row) => sum + row.products_recommended.length, 0);
  const addTotal = sessions.reduce((sum, row) => sum + row.products_added.length, 0);
  const conversionTotal = sessions.reduce((sum, row) => sum + row.conversion_count, 0);
  const addRate = recTotal > 0 ? addTotal / recTotal : 0;

  if (recTotal > 0) {
    insights.push({
      org_id: orgId,
      location_id: locationId,
      type: "conversion",
      severity: addRate < 0.15 ? "critical" : addRate < 0.3 ? "warning" : "info",
      title: "Recommendation conversion",
      detail: `${addTotal}/${recTotal} recommendations added to cart (${Math.round(addRate * 100)}%). ${conversionTotal} tracked conversions, ${orderedProductIds.size} products ordered.`,
      metadata: {
        recommended: recTotal,
        added: addTotal,
        conversionCount: conversionTotal,
        orderedProducts: orderedProductIds.size,
        addRate,
      },
      insight_date: insightDate,
    });
  }

  const viewedNotOrdered = new Map<string, number>();
  for (const session of sessions) {
    const addedIds = new Set(session.products_added);
    for (const view of session.scroll_context?.views ?? []) {
      if (view.count < 2) continue;
      const matched = products.find((product) =>
        matchesProduct(view.name, [product.name])
      );
      if (!matched) continue;
      if (addedIds.has(matched.id) || orderedProductIds.has(matched.id)) continue;
      viewedNotOrdered.set(
        matched.name,
        (viewedNotOrdered.get(matched.name) ?? 0) + view.count
      );
    }
  }

  const topViews = [...viewedNotOrdered.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topViews.length) {
    insights.push({
      org_id: orgId,
      location_id: locationId,
      type: "alert",
      severity: "warning",
      title: "Viewed but not ordered",
      detail: topViews.map(([name, count]) => `${name} (${count} views)`).join(", "),
      metadata: { products: topViews.map(([name, views]) => ({ name, views })) },
      insight_date: insightDate,
    });
  }

  const sessionRatings = sessions
    .map((row) => row.guest_rating)
    .filter((value): value is number => typeof value === "number");
  const allRatings = [
    ...feedbackRows.map((row) => row.rating),
    ...sessionRatings,
  ];
  const comments = [
    ...feedbackRows.map((row) => row.comment).filter(Boolean) as string[],
    ...sessions.map((row) => row.guest_feedback).filter(Boolean) as string[],
  ];

  if (allRatings.length) {
    const avg =
      Math.round(
        (allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length) *
          10
      ) / 10;
    const themes = topThemes(comments);
    insights.push({
      org_id: orgId,
      location_id: locationId,
      type: "feedback_summary",
      severity: avg < 3 ? "critical" : avg < 4 ? "warning" : "info",
      title: `Guest feedback · ${avg}/5`,
      detail:
        themes.length > 0
          ? `Average ${avg}/5 from ${allRatings.length} ratings. Themes: ${themes.map((item) => item.word).join(", ")}.`
          : `Average ${avg}/5 from ${allRatings.length} ratings.`,
      metadata: { averageRating: avg, ratingCount: allRatings.length, themes },
      insight_date: insightDate,
    });
  }

  return insights;
}

export async function generateAiIntelligence(
  admin: SupabaseClient,
  input: { orgId: string; insightDate: string; locationId?: string }
): Promise<AiInsightInsert[]> {
  const { orgId, insightDate, locationId } = input;
  const { start, end } = dateRange(insightDate);

  let sessionQuery = admin
    .from("ai_sessions")
    .select(
      "id, org_id, location_id, session_token, messages, products_recommended, products_added, conversion_count, scroll_context, nudges_shown, guest_rating, guest_feedback"
    )
    .eq("org_id", orgId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (locationId) sessionQuery = sessionQuery.eq("location_id", locationId);

  const { data: sessionRows, error: sessionError } = await sessionQuery;
  if (sessionError) throw new Error(sessionError.message);

  const sessions = (sessionRows ?? []) as SessionRow[];
  if (!sessions.length) return [];

  const locationIds = [...new Set(sessions.map((row) => row.location_id))];

  const { data: productRows } = await admin
    .from("products")
    .select("id, name, location_id")
    .in("location_id", locationIds)
    .is("deleted_at", null);

  const products = (productRows ?? []) as ProductRow[];

  const { data: feedbackRows } = await admin
    .from("order_feedback")
    .select("rating, comment, location_id, created_at")
    .in("location_id", locationIds)
    .gte("created_at", start)
    .lt("created_at", end);

  const sessionTokens = [...new Set(sessions.map((row) => row.session_token))];
  const { data: tableSessionRows } = await admin
    .from("table_sessions")
    .select("id, session_token")
    .in("session_token", sessionTokens);

  const tableSessionIds = (tableSessionRows ?? []).map(
    (row) => (row as { id: string }).id
  );

  const { data: orderRows } =
    tableSessionIds.length > 0
      ? await admin
          .from("orders")
          .select("location_id, order_items(product_id)")
          .in("session_id", tableSessionIds)
          .gte("created_at", start)
          .lt("created_at", end)
      : { data: [] };

  const insights: AiInsightInsert[] = [];
  for (const locId of locationIds) {
    const locSessions = sessions.filter((row) => row.location_id === locId);
    const locProducts = products.filter((row) => row.location_id === locId);
    const locFeedback = (feedbackRows ?? []).filter(
      (row) => (row as { location_id: string }).location_id === locId
    ) as Array<{ rating: number; comment: string | null }>;

    const orderedProductIds = new Set<string>();
    for (const order of orderRows ?? []) {
      const row = order as {
        location_id: string;
        order_items: Array<{ product_id: string }>;
      };
      if (row.location_id !== locId) continue;
      for (const item of row.order_items ?? []) {
        orderedProductIds.add(item.product_id);
      }
    }

    insights.push(
      ...analyzeLocationSessions(
        orgId,
        locId,
        insightDate,
        locSessions,
        locProducts,
        locFeedback,
        orderedProductIds
      )
    );
  }

  return insights;
}

export async function persistAiInsights(
  admin: SupabaseClient,
  orgId: string,
  insightDate: string,
  insights: AiInsightInsert[]
): Promise<number> {
  await admin
    .from("ai_insights")
    .delete()
    .eq("org_id", orgId)
    .eq("insight_date", insightDate);

  if (!insights.length) return 0;

  const { error } = await admin.from("ai_insights").insert(insights);
  if (error) throw new Error(error.message);
  return insights.length;
}

export async function runDailyAiIntelligence(
  admin: SupabaseClient,
  insightDate: string
): Promise<{ orgsProcessed: number; insightsWritten: number }> {
  const { start, end } = dateRange(insightDate);
  const { data: orgRows } = await admin
    .from("ai_sessions")
    .select("org_id")
    .gte("created_at", start)
    .lt("created_at", end);

  const orgIds = [...new Set((orgRows ?? []).map((row) => (row as { org_id: string }).org_id))];
  let insightsWritten = 0;

  for (const orgId of orgIds) {
    const insights = await generateAiIntelligence(admin, { orgId, insightDate });
    insightsWritten += await persistAiInsights(admin, orgId, insightDate, insights);
  }

  return { orgsProcessed: orgIds.length, insightsWritten };
}
