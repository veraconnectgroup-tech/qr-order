export const OPERATOR_API_VERSION = "1" as const;

export type OperatorPeriod = "today" | "yesterday" | "7d";

export type LocationSummary = {
  locationId: string;
  period: { from: string; to: string };
  commerce: {
    ordersCount: number;
    revenueCents: number;
    avgCheckCents: number;
    tipRate?: number;
  };
  denis: {
    sessionsCount: number;
    sessionsWithOrder: number;
    conversionRate: number;
    escalationsCount: number;
    avgTurnsPerSession: number;
    topLanguages: Array<{ lang: string; count: number }>;
    llmInvocationRate: number;
  };
  ops: {
    rushMinutes: number;
    openWaiterCalls: number;
    kdsBacklog?: number;
  };
};

export type DenisLocationMetrics = {
  locationId: string;
  period: { from: string; to: string };
  sessionsCount: number;
  sessionsWithDenisActivity: number;
  sessionsWithOrder: number;
  conversionRate: number;
  llmInvocationRate: number;
  avgTurnsPerSession: number;
  avgCreditsPerSession: number;
  escalationsCount: number;
  topLanguages: Array<{ lang: string; count: number }>;
  creditBalance: number | null;
  lowBalance: boolean;
};

export type OperatorSessionListItem = {
  id: string;
  locationId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  messageCount: number;
  language: string | null;
  converted: boolean;
};

export type SessionOutcome = "ordered" | "abandoned" | "handoff" | "active";

export type OperatorSessionSummary = {
  sessionId: string;
  locationId: string;
  status: string;
  outcome: SessionOutcome;
  openedAt: string;
  closedAt: string | null;
  turnCount: number;
  messageCount: number;
  language: string | null;
  intents: string[];
  ordersCount: number;
  transcript?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type OperatorLocationListItem = {
  id: string;
  name: string;
  denisEnabled: boolean;
};

export type OperatorOrderListItem = {
  orderId: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  itemCount: number;
  createdAt: string;
  sessionId: string | null;
};

export type OperatorTranscript = {
  sessionId: string;
  locationId: string;
  turns: Array<{ role: "user" | "assistant"; content: string }>;
  redacted: boolean;
};
