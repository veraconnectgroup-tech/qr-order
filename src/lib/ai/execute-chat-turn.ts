import { z } from "zod";
import {
  AI_CONFIG,
  isOpenAiConfigured,
  resolveAiPromptLanguage,
  resolveGuestMessageLanguage,
} from "@/lib/ai/config";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import {
  buildBrowseMessage,
  guestAskedForSuggestions,
  isExplicitBrowseQuery,
  isLikelyBrowseQuery,
  mergeBrowseRecommendations,
  searchCatalogProducts,
} from "@/lib/ai/catalog/catalog-search";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { getPlaybookPromptBlock } from "@/lib/ai/playbook/load-playbook";
import { moderateGuestInput } from "@/lib/ai/moderation";
import {
  formatDraftForPrompt,
  processOrderingTurn,
} from "@/lib/ai/ordering/ordering-turn";
import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import {
  finalizeOrderFlow,
  shouldHandleOrderFlowWithoutLlm,
} from "@/lib/ai/ordering/order-flow";
import {
  AiCircuitOpenError,
  AiOpenAiError,
  callOpenAiChat,
} from "@/lib/ai/openai-client";
import { parseAiStructuredResponse } from "@/lib/ai/parse-response";
import {
  formatOrderContextBlock,
  loadGuestOrdersForAi,
} from "@/lib/ai/order-context";
import type { AiGuestPreferences, OpenAiCallResult, OpenAiChatMessage } from "@/lib/ai/types";
import {
  aiSessionInactiveStatus,
  isAiSessionExpired,
  isAiSessionMessageLimitReached,
} from "@/lib/ai/session-lifecycle";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { parseBrowsingContextToScrollContext } from "@/lib/ai/scroll-context";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { sanitizeText } from "@/lib/security/sanitize";
import {
  zSanitizedText,
  zSessionToken,
  zUuid,
} from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const preferencesSchema = z
  .object({
    allergies: z
      .array(z.string().trim().max(100))
      .max(20)
      .optional()
      .transform((items) =>
        items?.map((item) => sanitizeText(item, 100)).filter(Boolean)
      ),
    mood: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) => (value ? sanitizeText(value, 200) : "")),
  })
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const allergies = value.allergies ?? [];
    const mood = value.mood ?? "";
    if (!allergies.length && !mood) return undefined;
    return { allergies, mood } satisfies AiGuestPreferences;
  });

export const aiChatRequestSchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  message: zSanitizedText(AI_CONFIG.input.maxLength),
  language: z.string().trim().min(2).max(10),
  sessionId: zUuid().optional(),
  preferences: preferencesSchema,
  includeOrderContext: z.boolean().optional().default(true),
  browsingContext: zSanitizedText(2000).optional(),
  allowOrdering: z.boolean().optional().default(true),
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type AiSessionRow = {
  id: string;
  org_id: string;
  location_id: string;
  table_id: string;
  session_token: string;
  language: string;
  guest_preferences: AiGuestPreferences;
  messages: StoredMessage[];
  tokens_used: number;
  credits_used: number;
  products_recommended: string[];
  products_added: string[];
  conversion_count: number;
  status: "active" | "completed" | "expired";
  created_at: string;
  order_draft: AiOrderDraft | null;
};

function parseGuestPreferences(value: unknown): AiGuestPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { allergies: [], mood: "" };
  }
  const row = value as { allergies?: unknown; mood?: unknown };
  const allergies = Array.isArray(row.allergies)
    ? row.allergies.filter((item): item is string => typeof item === "string")
    : [];
  return {
    allergies,
    mood: typeof row.mood === "string" ? row.mood : "",
  };
}

function toAiSessionRow(data: Record<string, unknown>): AiSessionRow {
  return {
    id: data.id as string,
    org_id: data.org_id as string,
    location_id: data.location_id as string,
    table_id: data.table_id as string,
    session_token: data.session_token as string,
    language: data.language as string,
    guest_preferences: parseGuestPreferences(data.guest_preferences),
    messages: Array.isArray(data.messages)
      ? (data.messages as StoredMessage[])
      : [],
    tokens_used: Number(data.tokens_used ?? 0),
    credits_used: Number(data.credits_used ?? 0),
    products_recommended: Array.isArray(data.products_recommended)
      ? (data.products_recommended as string[])
      : [],
    products_added: Array.isArray(data.products_added)
      ? (data.products_added as string[])
      : [],
    conversion_count: Number(data.conversion_count ?? 0),
    status: (data.status as AiSessionRow["status"]) ?? "active",
    created_at: data.created_at as string,
    order_draft: initDraftFromStorage(data.order_draft),
  };
}

function moderationErrorMessage(reason: string) {
  switch (reason) {
    case "empty_message":
      return "Please enter a message.";
    case "message_too_long":
      return "Message is too long.";
    case "blocked_pattern":
      return "Message could not be processed.";
    default:
      return "Message could not be processed.";
  }
}

function toOpenAiHistory(messages: StoredMessage[]): OpenAiChatMessage[] {
  return messages.slice(-10).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
}

function assistantContent(message: string, recommendations: { productId: string }[]) {
  return JSON.stringify({ message, recommendations });
}

async function resolveStructuredResponse(
  openAiResult: OpenAiCallResult,
  productMap: Record<string, { id: string; name: string; price: number; imageUrl: string | null }>,
  openAiMessages: OpenAiChatMessage[]
) {
  try {
    return {
      ...parseAiStructuredResponse(openAiResult.content, productMap),
      openAiResult,
    };
  } catch (firstError) {
    logger.warn("AI response parse failed, retrying OpenAI once", {
      error: firstError instanceof Error ? firstError.message : String(firstError),
    });

    for (let attempt = 0; attempt < AI_CONFIG.parseRetryAttempts; attempt++) {
      try {
        const retryResult = await callOpenAiChat(openAiMessages);
        return {
          ...parseAiStructuredResponse(retryResult.content, productMap),
          openAiResult: {
            content: retryResult.content,
            tokensUsed: openAiResult.tokensUsed + retryResult.tokensUsed,
            promptTokens: openAiResult.promptTokens + retryResult.promptTokens,
            completionTokens:
              openAiResult.completionTokens + retryResult.completionTokens,
            model: retryResult.model,
          },
        };
      } catch (retryError) {
        logger.warn("AI parse retry failed", {
          attempt: attempt + 1,
          error:
            retryError instanceof Error ? retryError.message : String(retryError),
        });
      }
    }

    return {
      structured: {
        message:
          "Sorry, I didn't catch that — could you try again?",
        recommendations: [] as { productId: string; reason: string }[],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
        intent: "chat" as const,
      },
      recommendations: [] as ReturnType<typeof parseAiStructuredResponse>["recommendations"],
      openAiResult,
      usedFallback: true,
    };
  }
}

/** Legacy LLM + ordering path — called from Denis runtime (M7). */
export async function executeChatTurn(body: unknown) {
  const parsed = aiChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const input = parsed.data;
  const moderation = moderateGuestInput(input.message);
  if (!moderation.safe) {
    return apiError(moderationErrorMessage(moderation.reason), 400);
  }

  if (!isOpenAiConfigured()) {
    return apiError("Denis is not configured.", 503, {
      code: "not_configured",
    });
  }

  const admin = createAdminClient();

  const guestContext = await verifyAiGuestContext(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.sessionToken,
  });

  if ("error" in guestContext) {
    return apiError(guestContext.error, guestContext.status);
  }

  const { orgId, orgName } = guestContext.data;

  const { data: creditsRow } = await admin
    .from("ai_credits")
    .select("balance")
    .eq("org_id", orgId)
    .maybeSingle();

  const balance = (creditsRow as { balance: number } | null)?.balance ?? 0;
  if (balance < AI_CONFIG.creditsPerMessage) {
    return apiError("insufficient_credits", 402);
  }

  const language = resolveAiPromptLanguage(input.language);
  const useEnglish = language === "en";

  let menuPayload;
  try {
    menuPayload = await getCachedMenuForLocation(input.locationId, {
      useEnglish,
    });
  } catch (error) {
    logger.error("AI menu load failed", {
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Menu could not be loaded.", 500);
  }

  if (!menuPayload.menuText) {
    return apiError("Menu is empty.", 404);
  }

  let sessionRow: AiSessionRow | null = null;

  if (input.sessionId) {
    const { data, error } = await admin
      .from("ai_sessions")
      .select("*")
      .eq("id", input.sessionId)
      .maybeSingle();

    if (error) {
      logger.error("AI session load failed", { error: error.message });
      return apiError("Could not load session.", 500);
    }

    if (!data) {
      return apiError("Session not found.", 404);
    }

    const row = toAiSessionRow(data as Record<string, unknown>);
    if (
      row.org_id !== orgId ||
      row.location_id !== input.locationId ||
      row.table_id !== input.tableId
    ) {
      return apiError("Unauthorized.", 401);
    }

    if (row.session_token !== input.sessionToken) {
      const { data: table } = await admin
        .from("tables")
        .select("qr_token")
        .eq("id", input.tableId)
        .maybeSingle();
      const qrToken = (table as { qr_token: string } | null)?.qr_token;

      if (qrToken && input.sessionToken === qrToken) {
        if (row.session_token !== qrToken) {
          await admin
            .from("ai_sessions")
            .update({ session_token: qrToken })
            .eq("id", row.id);
          row.session_token = qrToken;
        }
      } else if (qrToken && row.session_token === qrToken) {
        // Legacy client sent a table session token; stored row already uses QR.
      } else {
        return apiError("Unauthorized.", 401);
      }
    }

    if (row.status !== "active") {
      return apiError("Session is no longer active.", 410);
    }

    if (isAiSessionExpired(row)) {
      await admin
        .from("ai_sessions")
        .update({
          status: "expired",
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      sessionRow = null;
    } else if (isAiSessionMessageLimitReached(row)) {
      await admin
        .from("ai_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return apiError("Session message limit reached.", 410);
    } else {
      sessionRow = row;
    }
  }

  if (
    sessionRow &&
    aiSessionInactiveStatus(sessionRow) !== "active"
  ) {
    return apiError("Session is no longer active.", 410);
  }

  if (
    sessionRow &&
    sessionRow.messages.length + 2 > AI_CONFIG.maxMessagesPerSession
  ) {
    return apiError("Session message limit reached.", 410);
  }

  const guestPrefs =
    sessionRow?.guest_preferences ??
    input.preferences ??
    ({ allergies: [], mood: "" } satisfies AiGuestPreferences);

  let orderContext: string | null = null;
  if (input.includeOrderContext) {
    try {
      const guestOrders = await loadGuestOrdersForAi(
        admin,
        input.tableId,
        input.sessionToken
      );
      orderContext = formatOrderContextBlock(
        guestOrders,
        menuPayload.currency
      );
    } catch (error) {
      logger.error("AI order context load failed", {
        locationId: input.locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const priorMessages = sessionRow?.messages ?? [];
  const userMessage: StoredMessage = {
    role: "user",
    content: input.message,
    timestamp: new Date().toISOString(),
  };

  const allowOrdering = input.allowOrdering !== false;
  const catalog = {
    menuText: menuPayload.menuText,
    productMap: menuPayload.productMap,
    catalog: menuPayload.catalog,
    currency: menuPayload.currency,
    cachedAt: menuPayload.cachedAt,
  };

  let workingDraft = sessionRow?.order_draft ?? initDraftFromStorage(null);

  const preTurn = processOrderingTurn({
    userMessage: input.message,
    allowOrdering,
    orderDraftRaw: workingDraft,
    catalog,
  });
  workingDraft = preTurn.draft;

  const browseMatches = searchCatalogProducts(catalog.catalog, input.message);

  if (
    preTurn.cartActions.length === 0 &&
    !workingDraft.pending &&
    isExplicitBrowseQuery(input.message) &&
    browseMatches.length >= 2 &&
    preTurn.quickReplies.length === 0
  ) {
    const recommendations = mergeBrowseRecommendations(
      browseMatches,
      catalog.productMap,
      catalog.currency
    );
    const responseLanguage = resolveGuestMessageLanguage(
      input.message,
      language
    );
    const assistantText = buildBrowseMessage(browseMatches, responseLanguage);

    const assistantMessage: StoredMessage = {
      role: "assistant",
      content: assistantContent(assistantText, recommendations),
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...priorMessages, userMessage, assistantMessage];
    const scrollContext = input.browsingContext
      ? parseBrowsingContextToScrollContext(input.browsingContext)
      : null;

    let sessionId = sessionRow?.id;
    const recommendedIds = [
      ...new Set([
        ...(sessionRow?.products_recommended ?? []),
        ...recommendations.map((item) => item.productId),
      ]),
    ];
    const sessionPatch = {
      messages: updatedMessages,
      language,
      guest_preferences: guestPrefs as import("@/types/database").Json,
      order_draft: workingDraft as unknown as import("@/types/database").Json,
      products_recommended: recommendedIds,
      ...(scrollContext ? { scroll_context: scrollContext } : {}),
    };

    if (sessionRow) {
      const { error: updateError } = await admin
        .from("ai_sessions")
        .update(sessionPatch)
        .eq("id", sessionRow.id);
      if (updateError) {
        logger.error("AI session update failed", { error: updateError.message });
        return apiError("Could not update session.", 500);
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("ai_sessions")
        .insert({
          org_id: orgId,
          location_id: input.locationId,
          table_id: input.tableId,
          session_token: input.sessionToken,
          messages: updatedMessages,
          tokens_used: 0,
          credits_used: 0,
          products_recommended: recommendedIds,
          products_added: [],
          conversion_count: 0,
          status: "active",
          order_draft: workingDraft as unknown as import("@/types/database").Json,
          language,
          guest_preferences: guestPrefs,
          ...(scrollContext ? { scroll_context: scrollContext } : {}),
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        return apiError("Could not create session.", 500);
      }
      sessionId = (inserted as { id: string }).id;
    }

    const { data: creditsRow } = await admin
      .from("ai_credits")
      .select("balance")
      .eq("org_id", orgId)
      .maybeSingle();

    return apiSuccess({
      message: assistantText,
      recommendations,
      cartActions: [],
      quickReplies: [],
      intent: "menu_info",
      submitOrder: false,
      creditsRemaining: (creditsRow as { balance: number } | null)?.balance ?? 0,
      sessionId,
    });
  }

  if (preTurn.skippedLlm && preTurn.cartActions.length > 0) {
    const assistantText =
      preTurn.confirmationMessage ??
      `Added to cart: ${preTurn.cartActions.map((a) => a.productName).join(", ")}.`;

    const assistantMessage: StoredMessage = {
      role: "assistant",
      content: assistantText,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...priorMessages, userMessage, assistantMessage];
    const scrollContext = input.browsingContext
      ? parseBrowsingContextToScrollContext(input.browsingContext)
      : null;

    let sessionId = sessionRow?.id;
    const sessionPatch = {
      messages: updatedMessages,
      language,
      guest_preferences: guestPrefs as import("@/types/database").Json,
      order_draft: workingDraft as unknown as import("@/types/database").Json,
      ...(scrollContext ? { scroll_context: scrollContext } : {}),
    };

    if (sessionRow) {
      const { error: updateError } = await admin
        .from("ai_sessions")
        .update(sessionPatch)
        .eq("id", sessionRow.id);
      if (updateError) {
        logger.error("AI session update failed", { error: updateError.message });
        return apiError("Could not update session.", 500);
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("ai_sessions")
        .insert({
          org_id: orgId,
          location_id: input.locationId,
          table_id: input.tableId,
          session_token: input.sessionToken,
          messages: updatedMessages,
          tokens_used: 0,
          credits_used: 0,
          products_recommended: [],
          products_added: [],
          conversion_count: 0,
          status: "active",
          order_draft: workingDraft as unknown as import("@/types/database").Json,
          language,
          guest_preferences: guestPrefs,
          ...(scrollContext ? { scroll_context: scrollContext } : {}),
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        return apiError("Could not create session.", 500);
      }
      sessionId = (inserted as { id: string }).id;
    }

    const { data: creditsRow } = await admin
      .from("ai_credits")
      .select("balance")
      .eq("org_id", orgId)
      .maybeSingle();

    return apiSuccess({
      message: assistantText,
      recommendations: [],
      cartActions: preTurn.cartActions,
      quickReplies: preTurn.quickReplies,
      intent: preTurn.intent,
      submitOrder: false,
      creditsRemaining: (creditsRow as { balance: number } | null)?.balance ?? 0,
      sessionId,
    });
  }

  if (
    allowOrdering &&
    shouldHandleOrderFlowWithoutLlm(input.message, workingDraft)
  ) {
    const flowResult = finalizeOrderFlow({
      userMessage: input.message,
      draft: workingDraft,
      llmMessage: "",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language,
    });
    workingDraft = flowResult.draft;

    const assistantMessage: StoredMessage = {
      role: "assistant",
      content: assistantContent(flowResult.message, []),
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...priorMessages, userMessage, assistantMessage];
    const scrollContext = input.browsingContext
      ? parseBrowsingContextToScrollContext(input.browsingContext)
      : null;

    let sessionId = sessionRow?.id;
    const sessionPatch = {
      messages: updatedMessages,
      language,
      guest_preferences: guestPrefs as import("@/types/database").Json,
      order_draft: workingDraft as unknown as import("@/types/database").Json,
      ...(scrollContext ? { scroll_context: scrollContext } : {}),
    };

    if (sessionRow) {
      const { error: updateError } = await admin
        .from("ai_sessions")
        .update(sessionPatch)
        .eq("id", sessionRow.id);
      if (updateError) {
        logger.error("AI session update failed", { error: updateError.message });
        return apiError("Could not update session.", 500);
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("ai_sessions")
        .insert({
          org_id: orgId,
          location_id: input.locationId,
          table_id: input.tableId,
          session_token: input.sessionToken,
          messages: updatedMessages,
          tokens_used: 0,
          credits_used: 0,
          products_recommended: [],
          products_added: [],
          conversion_count: 0,
          status: "active",
          order_draft: workingDraft as unknown as import("@/types/database").Json,
          language,
          guest_preferences: guestPrefs,
          ...(scrollContext ? { scroll_context: scrollContext } : {}),
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        return apiError("Could not create session.", 500);
      }
      sessionId = (inserted as { id: string }).id;
    }

    const { data: creditsRow } = await admin
      .from("ai_credits")
      .select("balance")
      .eq("org_id", orgId)
      .maybeSingle();

    return apiSuccess({
      message: flowResult.message,
      recommendations: [],
      cartActions: [],
      quickReplies: [],
      intent: flowResult.intent,
      submitOrder: flowResult.submitOrder,
      creditsRemaining: (creditsRow as { balance: number } | null)?.balance ?? 0,
      sessionId,
    });
  }

  const systemPrompt = buildSystemPrompt({
    orgName,
    menuText: menuPayload.menuText,
    language,
    guestMessage: input.message,
    guestPrefs,
    orderContext,
    browsingContext: input.browsingContext ?? null,
    orderDraftContext: formatDraftForPrompt(workingDraft),
    allowOrdering,
    playbookContext: await getPlaybookPromptBlock(orgId, input.locationId),
  });

  const openAiMessages: OpenAiChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...toOpenAiHistory(priorMessages),
    { role: "user", content: input.message },
  ];

  let openAiResult;
  try {
    openAiResult = await callOpenAiChat(openAiMessages);
  } catch (error) {
    if (error instanceof AiCircuitOpenError) {
      return apiError(AI_CONFIG.circuitBreakerMessage, 503);
    }
    if (error instanceof AiOpenAiError) {
      logger.error("AI OpenAI call failed", {
        status: error.status,
        error: error.message,
      });
      return apiError("AI request failed.", error.status === 429 ? 429 : 502);
    }
    logger.error("AI OpenAI unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("AI request failed.", 502);
  }

  const resolved = await resolveStructuredResponse(
    openAiResult,
    menuPayload.productMap,
    openAiMessages
  );

  openAiResult = resolved.openAiResult;
  const structured = {
    structured: resolved.structured,
    recommendations: resolved.recommendations,
  };

  const orderingResult = processOrderingTurn({
    userMessage: input.message,
    allowOrdering,
    orderDraftRaw: workingDraft,
    catalog,
    structured: structured.structured,
  });
  workingDraft = orderingResult.draft;

  const flowResult = finalizeOrderFlow({
    userMessage: input.message,
    draft: workingDraft,
    llmMessage: structured.structured.message,
    llmSubmitOrder: structured.structured.submitOrder,
    cartActionsThisTurn: orderingResult.cartActions.length,
    language,
  });
  workingDraft = flowResult.draft;
  const assistantReplyMessage = flowResult.message;
  const submitOrder = flowResult.submitOrder;

  const guestWantsSuggestions = guestAskedForSuggestions(input.message);

  const shouldEnrichBrowse =
    guestWantsSuggestions &&
    isLikelyBrowseQuery(input.message) &&
    browseMatches.length >= 2 &&
    !workingDraft.pending &&
    orderingResult.cartActions.length === 0 &&
    !submitOrder &&
    orderingResult.quickReplies.length === 0 &&
    structured.structured.intent !== "clarify" &&
    structured.structured.intent !== "confirm" &&
    ["menu_info", "recommend", "chat"].includes(structured.structured.intent);

  const finalRecommendations = shouldEnrichBrowse
    ? mergeBrowseRecommendations(
        browseMatches,
        menuPayload.productMap,
        catalog.currency,
        structured.recommendations
      )
    : structured.recommendations;

  const displayRecommendations =
    !guestWantsSuggestions &&
    structured.structured.intent !== "menu_info"
      ? []
      : (structured.structured.intent === "clarify" ||
            structured.structured.intent === "confirm") &&
          orderingResult.quickReplies.length > 0
        ? []
        : finalRecommendations;

  logger.info("AI chat token usage", {
    sessionId: sessionRow?.id ?? "new",
    promptTokens: openAiResult.promptTokens,
    completionTokens: openAiResult.completionTokens,
    totalTokens: openAiResult.tokensUsed,
    usedFallback: "usedFallback" in resolved && resolved.usedFallback,
  });

  const { data: newBalance, error: debitError } = await admin.rpc(
    "decrement_ai_credits",
    {
      p_org_id: orgId,
      p_amount: AI_CONFIG.creditsPerMessage,
    }
  );

  if (debitError) {
    logger.error("AI credit debit failed", { error: debitError.message });
    return apiError("Could not debit credits.", 500);
  }

  if (newBalance === -1) {
    return apiError("insufficient_credits", 402);
  }

  const assistantMessage: StoredMessage = {
    role: "assistant",
    content: assistantContent(
      assistantReplyMessage,
      displayRecommendations
    ),
    timestamp: new Date().toISOString(),
  };

  const updatedMessages = [...priorMessages, userMessage, assistantMessage];
  const recommendedIds = [
    ...new Set([
      ...(sessionRow?.products_recommended ?? []),
      ...displayRecommendations.map((item) => item.productId),
    ]),
  ];

  const scrollContext = input.browsingContext
    ? parseBrowsingContextToScrollContext(input.browsingContext)
    : null;

  const tokensUsed =
    (sessionRow?.tokens_used ?? 0) + openAiResult.tokensUsed;
  const creditsUsed =
    (sessionRow?.credits_used ?? 0) + AI_CONFIG.creditsPerMessage;

  let sessionId = sessionRow?.id;

  if (sessionRow) {
    const { error: updateError } = await admin
      .from("ai_sessions")
      .update({
        messages: updatedMessages,
        tokens_used: tokensUsed,
        credits_used: creditsUsed,
        products_recommended: recommendedIds,
        language,
        guest_preferences: guestPrefs,
        order_draft: workingDraft as unknown as import("@/types/database").Json,
        ...(scrollContext ? { scroll_context: scrollContext } : {}),
      })
      .eq("id", sessionRow.id);

    if (updateError) {
      logger.error("AI session update failed", { error: updateError.message });
      return apiError("Could not update session.", 500);
    }
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("ai_sessions")
      .insert({
        org_id: orgId,
        location_id: input.locationId,
        table_id: input.tableId,
        session_token: input.sessionToken,
        language,
        guest_preferences: guestPrefs,
        messages: updatedMessages,
        tokens_used: tokensUsed,
        credits_used: creditsUsed,
        products_recommended: recommendedIds,
        products_added: [],
        conversion_count: 0,
        status: "active",
        order_draft: workingDraft as unknown as import("@/types/database").Json,
        ...(scrollContext ? { scroll_context: scrollContext } : {}),
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      logger.error("AI session insert failed", {
        error: insertError?.message ?? "unknown",
      });
      return apiError("Could not create session.", 500);
    }

    sessionId = (inserted as { id: string }).id;
  }

  return apiSuccess({
    message: assistantReplyMessage,
    recommendations: displayRecommendations,
    cartActions: orderingResult.cartActions,
    quickReplies: orderingResult.quickReplies,
    intent: flowResult.intent,
    submitOrder,
    creditsRemaining: newBalance as number,
    sessionId,
  });
}
