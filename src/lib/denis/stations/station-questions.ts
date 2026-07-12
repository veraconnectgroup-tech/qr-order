import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import type {
  ConciergeConfig,
  ConciergeStationQuestions,
} from "@/lib/denis/config/concierge-config.schema";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { escalateKitchenQuestionToBar } from "@/lib/denis/stations/escalate-kitchen-question-to-bar";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import {
  buildStationQuestionMessage,
  evaluateStationQuestionTriggers,
  shouldSkipStationQuestionCandidate,
  type StationQuestionCandidate,
  type StationQuestionStation,
  type StationQuestionType,
} from "@/lib/denis/stations/question-triggers";
import { orderFactToTriggerOrder } from "@/lib/denis/stations/order-fact-station";
import {
  cachedStationAnswerGuestMessage,
  stationAnswerGuestMessage,
  stationCheckingGuestMessage,
  type FreshStationAnswer,
  type StationQuestionAnswerValue,
} from "@/lib/denis/stations/station-question-messages";
import type { OrderFact } from "@/lib/denis/loop/types";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";
import { logger } from "@/lib/logger";
import { notifyGuestSessionPush } from "@/lib/push/notify-guest-session";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StationQuestionRow =
  Database["public"]["Tables"]["station_questions"]["Row"];

export type StationQuestionAskedBy = StationQuestionRow["asked_by"];

export type CreateStationQuestionResult =
  | { created: true; question: StationQuestionRow }
  | {
      created: false;
      reason:
        | "disabled"
        | "order_closed"
        | "already_open"
        | "cooldown"
        | "station_busy"
        | "insert_failed";
    };

export type CreateStationQuestionInput = {
  locationId: string;
  orderId: string;
  tableId: string | null;
  station: StationQuestionStation;
  questionType: StationQuestionType;
  message: string;
  askedBy: StationQuestionAskedBy;
  sourceEvent: string | null;
  config: ConciergeStationQuestions;
};

const CLOSED_ORDER_STATUSES = ["delivered", "cancelled", "rejected"];

/**
 * expireStationQuestions is a cron-invoked, per-location sweep with no
 * caller-supplied config — degrade to "no escalation this tick" on any
 * config-load failure rather than let it take down the whole expiry
 * sweep (same degrade-gracefully posture as the Redis helpers elsewhere
 * in this codebase).
 */
async function loadStationQuestionsConfigSafely(
  locationId: string
): Promise<ConciergeStationQuestions | null> {
  try {
    const config = await loadConciergeConfigForLocation(locationId);
    return config.ops.stationQuestions;
  } catch (error) {
    logger.warn("loadStationQuestionsConfigSafely failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Create a question card with anti-spam guardrails:
 * max 1 open per (order, station), cooldown after answer/expiry,
 * open-questions cap per station. Manager asks bypass cooldown + cap.
 */
export async function createStationQuestion(
  admin: SupabaseClient,
  input: CreateStationQuestionInput
): Promise<CreateStationQuestionResult> {
  if (!input.config.enabled) {
    return { created: false, reason: "disabled" };
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", input.orderId)
    .maybeSingle();

  const orderStatus = (orderRow as { status?: string } | null)?.status ?? null;
  if (!orderStatus || CLOSED_ORDER_STATUSES.includes(orderStatus)) {
    return { created: false, reason: "order_closed" };
  }
  if (orderStatus === "ready" && input.questionType !== "ready_pickup") {
    return { created: false, reason: "order_closed" };
  }

  const { data: recentRows } = await admin
    .from("station_questions")
    .select("id, status, asked_at")
    .eq("order_id", input.orderId)
    .eq("station", input.station)
    .order("asked_at", { ascending: false })
    .limit(1);

  const recent = (recentRows ?? [])[0] as
    | Pick<StationQuestionRow, "id" | "status" | "asked_at">
    | undefined;

  if (recent?.status === "open") {
    return { created: false, reason: "already_open" };
  }

  const isManager = input.askedBy === "manager";
  if (recent && !isManager) {
    const cooldownMs = input.config.cooldownMinutes * 60_000;
    if (Date.now() - Date.parse(recent.asked_at) < cooldownMs) {
      return { created: false, reason: "cooldown" };
    }
  }

  if (!isManager) {
    const { count } = await admin
      .from("station_questions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", input.locationId)
      .eq("station", input.station)
      .eq("status", "open");

    if ((count ?? 0) >= input.config.maxOpenPerStation) {
      return { created: false, reason: "station_busy" };
    }
  }

  const expiresAt = new Date(
    Date.now() + input.config.expirySeconds * 1000
  ).toISOString();

  const { data: inserted, error } = await admin
    .from("station_questions")
    .insert({
      location_id: input.locationId,
      order_id: input.orderId,
      table_id: input.tableId,
      station: input.station,
      question_type: input.questionType,
      message: input.message,
      asked_by: input.askedBy,
      source_event: input.sourceEvent,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    logger.warn("createStationQuestion insert failed", {
      orderId: input.orderId,
      station: input.station,
      error: error?.message,
    });
    return { created: false, reason: "insert_failed" };
  }

  const question = inserted as StationQuestionRow;

  await appendQuestionTimelineEvent(admin, question, "station.question.asked", {
    message: question.message,
  });

  return { created: true, question };
}

export type AnswerStationQuestionResult =
  | { ok: true; question: StationQuestionRow }
  | { ok: false; error: "not_open" | "invalid_eta" | "update_failed" };

/** One-tap station answer → guest tell + escalations + timeline. */
export async function answerStationQuestion(
  admin: SupabaseClient,
  input: {
    questionId: string;
    answer: StationQuestionAnswerValue;
    etaMinutes?: number | null;
    staffId: string;
  }
): Promise<AnswerStationQuestionResult> {
  const etaMinutes = input.answer === "eta" ? input.etaMinutes ?? null : null;
  if (input.answer === "eta" && (!etaMinutes || etaMinutes <= 0)) {
    return { ok: false, error: "invalid_eta" };
  }

  const { data: updated, error } = await admin
    .from("station_questions")
    .update({
      status: "answered",
      answer: input.answer,
      answer_eta_minutes: etaMinutes,
      answered_by: input.staffId,
      answered_at: new Date().toISOString(),
    })
    .eq("id", input.questionId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error) {
    logger.warn("answerStationQuestion update failed", {
      questionId: input.questionId,
      error: error.message,
    });
    return { ok: false, error: "update_failed" };
  }

  if (!updated) {
    return { ok: false, error: "not_open" };
  }

  const question = updated as StationQuestionRow;

  try {
    await runAnswerSideEffects(admin, question);
  } catch (sideEffectError) {
    logger.warn("station question answer side effects failed", {
      questionId: question.id,
      error:
        sideEffectError instanceof Error
          ? sideEffectError.message
          : String(sideEffectError),
    });
  }

  return { ok: true, question };
}

/** Expire stale open questions at every location that has them (cron-safe). */
export async function expireStaleStationQuestionsGlobally(
  admin: SupabaseClient
): Promise<number> {
  const { data: rows, error } = await admin
    .from("station_questions")
    .select("location_id")
    .eq("status", "open")
    .lt("expires_at", new Date().toISOString());

  if (error) {
    logger.warn("expireStaleStationQuestionsGlobally lookup failed", {
      error: error.message,
    });
    return 0;
  }

  const locationIds = [
    ...new Set(
      (rows ?? []).map((row) => (row as { location_id: string }).location_id)
    ),
  ];

  let expired = 0;
  for (const locationId of locationIds) {
    expired += await expireStationQuestions(admin, { locationId });
  }
  return expired;
}

/**
 * Expire unanswered questions past expires_at → escalate to manager.
 * `reason` tags the timeline event ("ttl" = normal SLA expiry, "day_close" =
 * ADR-045 Day Close closing out anything still open at shift end).
 */
export async function expireStationQuestions(
  admin: SupabaseClient,
  input: { locationId: string; reason?: "ttl" | "day_close" }
): Promise<number> {
  const reason = input.reason ?? "ttl";

  const query = admin
    .from("station_questions")
    .update({ status: "expired" })
    .eq("location_id", input.locationId)
    .eq("status", "open");

  const { data: expiredRows, error } = await (
    reason === "day_close" ? query : query.lt("expires_at", new Date().toISOString())
  ).select("*");

  if (error) {
    logger.warn("expireStationQuestions failed", {
      locationId: input.locationId,
      reason,
      error: error.message,
    });
    return 0;
  }

  const expired = (expiredRows ?? []) as StationQuestionRow[];
  const stationConfig =
    expired.length > 0 ? await loadStationQuestionsConfigSafely(input.locationId) : null;

  for (const question of expired) {
    const context = await loadQuestionContext(admin, question);

    const escalation = stationConfig
      ? await escalateKitchenQuestionToBar(admin, question, stationConfig)
      : null;

    if (!escalation?.escalated) {
      const stationLabel = question.station === "kitchen" ? "Kuhinja" : "Bar";
      const bon =
        context?.orderNumber != null ? ` · Bon #${context.orderNumber}` : "";

      await dispatchStaffNotification({
        orgId: context?.orgId,
        locationId: question.location_id,
        type: "denis_escalation",
        tableId: question.table_id ?? undefined,
        tableName: context?.tableName ?? undefined,
        message: `${stationLabel} ne odgovara na Denis pitanje${bon} — proveri stanicu.`,
        actionUrl: question.station === "kitchen" ? "/kitchen" : "/bar",
      }).catch(() => undefined);
    }

    await appendQuestionTimelineEvent(
      admin,
      question,
      "station.question.expired",
      { reason, escalatedToBar: escalation?.escalated ?? false },
      context
    );
  }

  return expired.length;
}

/**
 * Retention sweep for the per-question voice conversation log (ADR-045 S3,
 * memory-registry.ts's "shift" tier, retentionDays: 1). Deletes turns older
 * than the retention window for this location's questions — independent of
 * question status, since a turn's own age is what matters here, not whether
 * its parent question is still open.
 */
export async function expireStationQuestionTurns(
  admin: SupabaseClient,
  input: { locationId: string; retentionDays: number }
): Promise<number> {
  const cutoff = new Date(
    Date.now() - input.retentionDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: questionRows, error: questionError } = await admin
    .from("station_questions")
    .select("id")
    .eq("location_id", input.locationId);

  if (questionError) {
    logger.warn("expireStationQuestionTurns question lookup failed", {
      locationId: input.locationId,
      error: questionError.message,
    });
    return 0;
  }

  const questionIds = (questionRows ?? []).map((row) => (row as { id: string }).id);
  if (questionIds.length === 0) return 0;

  const { data: deletedRows, error } = await admin
    .from("station_question_turns")
    .delete()
    .in("station_question_id", questionIds)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    logger.warn("expireStationQuestionTurns delete failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return 0;
  }

  return deletedRows?.length ?? 0;
}

export type { FreshStationAnswer, StationQuestionAnswerValue };
export {
  cachedStationAnswerGuestMessage,
  stationAnswerGuestMessage,
  stationCheckingGuestMessage,
};

/** Latest answered question for the order — Denis reuses it instead of re-asking. */
export async function getFreshStationAnswer(
  admin: SupabaseClient,
  input: { orderId: string; maxAgeMinutes: number }
): Promise<FreshStationAnswer | null> {
  const cutoff = new Date(
    Date.now() - input.maxAgeMinutes * 60_000
  ).toISOString();

  const { data } = await admin
    .from("station_questions")
    .select("station, answer, answer_eta_minutes, answered_at")
    .eq("order_id", input.orderId)
    .eq("status", "answered")
    .gte("answered_at", cutoff)
    .order("answered_at", { ascending: false })
    .limit(1);

  const row = (data ?? [])[0] as
    | Pick<
        StationQuestionRow,
        "station" | "answer" | "answer_eta_minutes" | "answered_at"
      >
    | undefined;

  if (!row?.answer || !row.answered_at) return null;

  return {
    station: row.station,
    answer: row.answer,
    etaMinutes: row.answer_eta_minutes,
    answeredAt: row.answered_at,
    ageMinutes: Math.max(
      0,
      Math.floor((Date.now() - Date.parse(row.answered_at)) / 60_000)
    ),
  };
}

type WatcherOrder = OrderFact;

function toTriggerOrder(order: WatcherOrder) {
  return orderFactToTriggerOrder(order);
}

/** Watcher tick — evaluate T2/T4/T5/T6 triggers for one session's orders. */
export async function runStationQuestionTriggersForSession(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    tableName: string;
    orders: WatcherOrder[];
    config: ConciergeConfig;
  }
): Promise<number> {
  const settings = input.config.ops.stationQuestions;
  if (!settings.enabled) return 0;

  const triggerOrders = input.orders.map(toTriggerOrder);
  const candidates = evaluateStationQuestionTriggers({
    orders: triggerOrders,
    config: settings,
  });

  let created = 0;
  for (const candidate of candidates) {
    const order = triggerOrders.find((row) => row.id === candidate.orderId);
    if (
      order &&
      shouldSkipStationQuestionCandidate(candidate, order)
    ) {
      continue;
    }

    const result = await createStationQuestion(admin, {
      locationId: input.locationId,
      orderId: candidate.orderId,
      tableId: input.tableId,
      station: candidate.station,
      questionType: candidate.questionType,
      message: buildStationQuestionMessage({
        questionType: candidate.questionType,
        station: candidate.station,
        tableName: input.tableName,
        orderNumber: candidate.orderNumber,
        waitMinutes: candidate.waitMinutes,
      }),
      askedBy: "denis",
      sourceEvent: candidate.sourceEvent,
      config: settings,
    });
    if (result.created) created += 1;
  }

  return created;
}

export type { StationQuestionCandidate };

type GuestStatusOrder = {
  id: string;
  orderNumber: number | null;
  status: string;
  createdAt: string;
  items: Array<{ menuSection?: string | null }>;
};

const GUEST_ASK_MIN_WAIT_MINUTES = 2;

/**
 * T1 — guest asks "where is my order?". Reuse a fresh station answer when one
 * exists (no re-ask inside cooldown); otherwise send a question card and tell
 * the guest we're checking. Returns the guest-facing line, or null when the
 * regular status template should be used.
 */
export async function handleGuestStatusQuery(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    tableName: string | null;
    orders: GuestStatusOrder[];
    config: ConciergeConfig;
    language: string;
  }
): Promise<string | null> {
  const settings = input.config.ops.stationQuestions;
  if (!settings.enabled) return null;

  const order = input.orders.find((candidate) =>
    ["pending", "pending_approval", "accepted", "preparing"].includes(
      candidate.status
    )
  );
  if (!order) return null;

  const fresh = await getFreshStationAnswer(admin, {
    orderId: order.id,
    maxAgeMinutes: settings.cooldownMinutes,
  });
  if (fresh) {
    return cachedStationAnswerGuestMessage({
      fresh,
      language: input.language,
    });
  }

  const waitMinutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(order.createdAt)) / 60_000)
  );
  if (waitMinutes < GUEST_ASK_MIN_WAIT_MINUTES) return null;

  const hasKitchenItems = order.items.some((item) =>
    isKitchenMenuSection(item.menuSection)
  );
  const hasDrinkItems = order.items.some(
    (item) => item.menuSection === "drinks"
  );
  if (!hasKitchenItems && !hasDrinkItems) return null;

  const station: StationQuestionStation = hasKitchenItems ? "kitchen" : "bar";

  const result = await createStationQuestion(admin, {
    locationId: input.locationId,
    orderId: order.id,
    tableId: input.tableId,
    station,
    questionType: "eta",
    message: buildStationQuestionMessage({
      questionType: "eta",
      station,
      tableName: input.tableName ?? "—",
      orderNumber: order.orderNumber,
      waitMinutes,
    }),
    askedBy: "guest_trigger",
    sourceEvent: "guest_ask",
    config: settings,
  });

  if (result.created || (!result.created && result.reason === "already_open")) {
    return stationCheckingGuestMessage({
      station,
      language: input.language,
    });
  }

  return null;
}

type QuestionContext = {
  orderNumber: number | null;
  sessionId: string | null;
  aiSessionId: string | null;
  tableName: string | null;
  orgId: string | undefined;
  language: string;
};

async function loadQuestionContext(
  admin: SupabaseClient,
  question: StationQuestionRow
): Promise<QuestionContext | null> {
  try {
    const [orderResult, tableResult, locationResult] = await Promise.all([
      question.order_id
        ? admin
            .from("orders")
            .select("order_number, session_id")
            .eq("id", question.order_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      question.table_id
        ? admin
            .from("tables")
            .select("name")
            .eq("id", question.table_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("locations")
        .select("org_id, menu_locale")
        .eq("id", question.location_id)
        .maybeSingle(),
    ]);

    const order = orderResult.data as {
      order_number: number | null;
      session_id: string | null;
    } | null;
    const table = tableResult.data as { name: string } | null;
    const location = locationResult.data as {
      org_id: string;
      menu_locale?: string | null;
    } | null;

    let aiSessionId: string | null = null;
    if (order?.session_id) {
      const { data: session } = await admin
        .from("table_sessions")
        .select("denis_shared_ai_session_id")
        .eq("id", order.session_id)
        .maybeSingle();
      aiSessionId =
        (session as { denis_shared_ai_session_id: string | null } | null)
          ?.denis_shared_ai_session_id ?? null;
    }

    return {
      orderNumber: order?.order_number ?? null,
      sessionId: order?.session_id ?? null,
      aiSessionId,
      tableName: table?.name ?? null,
      orgId: location?.org_id,
      language: location?.menu_locale?.trim().slice(0, 2) || "sr",
    };
  } catch (error) {
    logger.warn("loadQuestionContext failed", {
      questionId: question.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function appendQuestionTimelineEvent(
  admin: SupabaseClient,
  question: StationQuestionRow,
  eventType:
    | "station.question.asked"
    | "station.question.answered"
    | "station.question.expired",
  extra: Record<string, unknown>,
  preloadedContext?: QuestionContext | null
): Promise<void> {
  const context =
    preloadedContext !== undefined
      ? preloadedContext
      : await loadQuestionContext(admin, question);
  if (!context?.aiSessionId) return;

  await appendDenisTimelineEvent(admin, {
    aiSessionId: context.aiSessionId,
    eventType,
    traceId: createTurnTraceId(),
    payload: {
      type: eventType,
      questionId: question.id,
      orderId: question.order_id,
      station: question.station,
      questionType: question.question_type,
      askedBy: question.asked_by,
      sourceEvent: question.source_event,
      answer: question.answer,
      etaMinutes: question.answer_eta_minutes,
      ...extra,
    },
  });
}

async function tellGuest(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    sessionId: string | null;
    message: string;
  }
): Promise<void> {
  const traceId = createTurnTraceId();

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "tell.committed",
    traceId,
    payload: {
      type: "tell.committed",
      message: input.message,
      tier: "template",
      source: "station.question",
      linted: true,
    },
  });

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "narration.sent",
    traceId,
    payload: {
      type: "narration.sent",
      message: input.message,
      tier: "template",
      linted: true,
      source: "station.question",
    },
  });

  if (input.sessionId) {
    await notifyGuestSessionPush(admin, {
      sessionId: input.sessionId,
      pushType: "guest-denis-message",
      message: input.message,
    }).catch(() => undefined);
  }
}

async function runAnswerSideEffects(
  admin: SupabaseClient,
  question: StationQuestionRow
): Promise<void> {
  const context = await loadQuestionContext(admin, question);
  const stationLabel = question.station === "kitchen" ? "Kuhinja" : "Bar";
  const bon =
    context?.orderNumber != null ? ` · Bon #${context.orderNumber}` : "";
  const tableLabel = context?.tableName ? `Sto ${context.tableName}` : "Sto";

  // Guest hears truthful updates for guest-facing questions.
  const guestFacing =
    question.asked_by === "guest_trigger" ||
    question.question_type === "eta" ||
    question.question_type === "mixed_conflict";

  if (guestFacing && context?.aiSessionId && question.answer) {
    const shouldTellProblem =
      question.answer !== "problem" || question.asked_by === "guest_trigger";
    const guestMessage = stationAnswerGuestMessage({
      station: question.station,
      answer: question.answer,
      etaMinutes: question.answer_eta_minutes,
      language: context.language,
    });
    if (guestMessage && shouldTellProblem) {
      await tellGuest(admin, {
        aiSessionId: context.aiSessionId,
        sessionId: context.sessionId,
        message: guestMessage,
      });
    }
  }

  if (question.answer === "problem") {
    await dispatchStaffNotification({
      orgId: context?.orgId,
      locationId: question.location_id,
      type: "denis_escalation",
      tableId: question.table_id ?? undefined,
      tableName: context?.tableName ?? undefined,
      message: `${tableLabel}${bon} — ${stationLabel.toLowerCase()} prijavljuje problem sa porudžbinom.`,
      priorityOverride: "urgent",
      playSound: true,
    }).catch(() => undefined);
  }

  if (question.answer === "still_waiting") {
    await dispatchStaffNotification({
      orgId: context?.orgId,
      locationId: question.location_id,
      type: "long_wait",
      tableId: question.table_id ?? undefined,
      tableName: context?.tableName ?? undefined,
      message: `${tableLabel}${bon} — spremno čeka na prozoru. Preuzmi.`,
      playSound: true,
    }).catch(() => undefined);
  }

  await appendQuestionTimelineEvent(
    admin,
    question,
    "station.question.answered",
    {},
    context
  );
}
