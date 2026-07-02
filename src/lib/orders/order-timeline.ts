import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderTimelineKind =
  | "order.created"
  | "order.accepted"
  | "order.preparing"
  | "order.ready"
  | "order.delivered"
  | "order.event"
  | "station.queued"
  | "station.in_prep"
  | "station.ready"
  | "station.picked_up"
  | "station.served"
  | "denis.question.asked"
  | "denis.question.answered"
  | "denis.question.expired";

export type OrderTimelineEntry = {
  at: string;
  kind: OrderTimelineKind;
  label: string;
  actor?: string | null;
  detail?: string | null;
  denis?: boolean;
};

export type OrderTimelineOrderInput = {
  created_at: string;
  accepted_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
};

export type OrderTimelineEventInput = {
  event_type: string;
  created_at: string;
  actor_type: string | null;
  payload?: unknown;
};

export type OrderTimelineStationStateInput = {
  station: "kitchen" | "bar";
  queued_at: string;
  in_prep_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  served_at: string | null;
};

export type OrderTimelineStationQuestionInput = {
  station: "kitchen" | "bar";
  question_type: string;
  message: string;
  status: string;
  answer: string | null;
  answer_eta_minutes: number | null;
  asked_by: string;
  asked_at: string;
  answered_at: string | null;
  expires_at: string;
};

const ORDER_EVENT_LABELS: Record<string, string> = {
  "order.created": "Order submitted",
  "order.approval_requested": "Table approval requested",
  "order.approved": "Table approved order",
  storno: "Order storno",
};

const STATION_LABEL: Record<"kitchen" | "bar", string> = {
  kitchen: "Kitchen",
  bar: "Bar",
};

function stationName(station: "kitchen" | "bar"): string {
  return STATION_LABEL[station];
}

function formatActor(actorType: string | null): string | null {
  if (!actorType) return null;
  if (actorType === "staff") return "Staff";
  if (actorType === "system") return "System";
  return actorType;
}

function formatQuestionAnswer(input: OrderTimelineStationQuestionInput): string {
  if (!input.answer) return "No answer recorded";
  if (input.answer === "eta" && input.answer_eta_minutes) {
    return `ETA ~${input.answer_eta_minutes} min`;
  }
  return input.answer.replaceAll("_", " ");
}

function hasNearbyOrderEvent(
  events: OrderTimelineEventInput[],
  at: string,
  eventType: string,
  windowMs = 5000
): boolean {
  const target = Date.parse(at);
  if (!Number.isFinite(target)) return false;
  return events.some((event) => {
    if (event.event_type !== eventType) return false;
    const ts = Date.parse(event.created_at);
    return Number.isFinite(ts) && Math.abs(ts - target) <= windowMs;
  });
}

function pushStationStep(
  entries: OrderTimelineEntry[],
  input: {
    at: string | null;
    station: "kitchen" | "bar";
    kind: OrderTimelineKind;
    label: string;
  }
): void {
  if (!input.at) return;
  entries.push({
    at: input.at,
    kind: input.kind,
    label: input.label,
  });
}

/** Pure merge/sort — unit-testable (ADR-043 S5). */
export function mergeOrderTimelineEvents(input: {
  order: OrderTimelineOrderInput;
  orderEvents: OrderTimelineEventInput[];
  stationStates: OrderTimelineStationStateInput[];
  stationQuestions: OrderTimelineStationQuestionInput[];
}): OrderTimelineEntry[] {
  const entries: OrderTimelineEntry[] = [];

  if (
    !hasNearbyOrderEvent(input.orderEvents, input.order.created_at, "order.created")
  ) {
    entries.push({
      at: input.order.created_at,
      kind: "order.created",
      label: "Order created",
    });
  }

  for (const event of input.orderEvents) {
    const label = ORDER_EVENT_LABELS[event.event_type] ?? event.event_type;
    entries.push({
      at: event.created_at,
      kind: "order.event",
      label,
      actor: formatActor(event.actor_type),
      detail:
        event.event_type === "storno" && event.payload
          ? JSON.stringify(event.payload)
          : undefined,
    });
  }

  if (input.order.accepted_at) {
    entries.push({
      at: input.order.accepted_at,
      kind: "order.accepted",
      label: "Order accepted",
    });
  }

  if (input.order.preparing_at) {
    entries.push({
      at: input.order.preparing_at,
      kind: "order.preparing",
      label: "Preparing started",
    });
  }

  if (input.order.ready_at) {
    entries.push({
      at: input.order.ready_at,
      kind: "order.ready",
      label: "Order ready",
    });
  }

  if (input.order.delivered_at) {
    entries.push({
      at: input.order.delivered_at,
      kind: "order.delivered",
      label: "Delivered",
    });
  }

  for (const state of input.stationStates) {
    const name = stationName(state.station);
    pushStationStep(entries, {
      at: state.queued_at,
      station: state.station,
      kind: "station.queued",
      label: `${name} received`,
    });
    pushStationStep(entries, {
      at: state.in_prep_at,
      station: state.station,
      kind: "station.in_prep",
      label: `${name} in prep`,
    });
    pushStationStep(entries, {
      at: state.ready_at,
      station: state.station,
      kind: "station.ready",
      label: `${name} ready`,
    });
    pushStationStep(entries, {
      at: state.picked_up_at,
      station: state.station,
      kind: "station.picked_up",
      label: `${name} picked up`,
    });
    pushStationStep(entries, {
      at: state.served_at,
      station: state.station,
      kind: "station.served",
      label: `${name} served`,
    });
  }

  for (const question of input.stationQuestions) {
    const name = stationName(question.station);
    entries.push({
      at: question.asked_at,
      kind: "denis.question.asked",
      label: `Denis asked ${name.toLowerCase()}`,
      actor: question.asked_by === "manager" ? "Manager" : "Denis",
      detail: question.message,
      denis: true,
    });

    if (question.status === "answered" && question.answered_at) {
      entries.push({
        at: question.answered_at,
        kind: "denis.question.answered",
        label: `${name} answered`,
        detail: formatQuestionAnswer(question),
        denis: true,
      });
    }

    if (question.status === "expired") {
      entries.push({
        at: question.expires_at,
        kind: "denis.question.expired",
        label: `${name} question expired`,
        detail: "Escalation via S0 expiry flow",
        denis: true,
      });
    }
  }

  return entries.sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.label.localeCompare(b.label)
  );
}

/** Read-only timeline for one order — merges existing audit sources (ADR-043 S5). */
export async function loadOrderTimeline(
  admin: SupabaseClient,
  orderId: string
): Promise<OrderTimelineEntry[]> {
  const [orderResult, eventsResult, statesResult, questionsResult] =
    await Promise.all([
      admin
        .from("orders")
        .select(
          "created_at, accepted_at, preparing_at, ready_at, delivered_at"
        )
        .eq("id", orderId)
        .maybeSingle(),
      admin
        .from("order_events")
        .select("event_type, created_at, actor_type, payload")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      admin
        .from("order_station_states")
        .select(
          "station, queued_at, in_prep_at, ready_at, picked_up_at, served_at"
        )
        .eq("order_id", orderId),
      admin
        .from("station_questions")
        .select(
          "station, question_type, message, status, answer, answer_eta_minutes, asked_by, asked_at, answered_at, expires_at"
        )
        .eq("order_id", orderId)
        .order("asked_at", { ascending: true }),
    ]);

  if (orderResult.error) {
    throw new Error(orderResult.error.message);
  }

  if (!orderResult.data) {
    return [];
  }

  return mergeOrderTimelineEvents({
    order: orderResult.data as OrderTimelineOrderInput,
    orderEvents: (eventsResult.data ?? []) as OrderTimelineEventInput[],
    stationStates: (statesResult.data ?? []) as OrderTimelineStationStateInput[],
    stationQuestions: (questionsResult.data ??
      []) as OrderTimelineStationQuestionInput[],
  });
}
