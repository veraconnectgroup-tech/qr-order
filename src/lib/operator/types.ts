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
    waiterGapRate: number;
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
  /** Sessions with waiter obligation gaps / sessions with Denis activity (ADR-032). */
  waiterGapRate: number;
  avgTurnsPerSession: number;
  avgCreditsPerSession: number;
  escalationsCount: number;
  topLanguages: Array<{ lang: string; count: number }>;
  creditBalance: number | null;
  lowBalance: boolean;
};

export type OperatorSessionMetrics = {
  turnCount: number;
  llmTurnCount: number;
  llmInvocationRate: number;
  gapTurnCount: number;
  gapRate: number;
};

export type OperatorBeliefsSummary = {
  beliefsHash: string;
  beliefCount: number;
  summary: Record<string, unknown>;
  compiledAt: string | null;
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
  metrics: OperatorSessionMetrics | null;
  beliefs: OperatorBeliefsSummary | null;
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

export type OperatorPaymentBucket = "cash" | "card" | "online" | "other";

export type OperatorTaxBreakdownLine = {
  rate: number;
  netCents: number;
  taxCents: number;
  grossCents: number;
};

export type OperatorOrderDetailItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  taxRate: number;
  menuSection: string;
  notes: string | null;
  modifiers: Array<{ name: string; priceCents: number }>;
};

export type OperatorOrderDetail = {
  orderId: string;
  orderNumber: number;
  locationId: string;
  locationName: string;
  status: string;
  paymentMethod: OperatorPaymentBucket;
  paymentMethodRaw: string;
  paymentStatus: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  tipCents: number;
  sessionId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  taxBreakdown: OperatorTaxBreakdownLine[];
  items: OperatorOrderDetailItem[];
};

export type OperatorCommerceMenuLine = {
  productName: string;
  quantity: number;
  revenueCents: number;
};

export type OperatorCommerceDailyLine = {
  date: string;
  ordersCount: number;
  revenueCents: number;
  avgCheckCents: number;
};

export type OperatorCommerceInsights = {
  locationId: string;
  locationName: string;
  period: { from: string; to: string };
  summary: {
    ordersCount: number;
    revenueCents: number;
    avgCheckCents: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  };
  paymentSummary?: {
    cashCents: number;
    cardCents: number;
    onlineCents: number;
    otherCents: number;
  };
  taxSummary?: {
    breakdown: OperatorTaxBreakdownLine[];
    mwst19: OperatorTaxBreakdownLine | null;
    mwst7: OperatorTaxBreakdownLine | null;
  };
  menu?: OperatorCommerceMenuLine[];
  daily?: OperatorCommerceDailyLine[];
  conversion?: {
    sessionsCount: number;
    sessionsWithOrder: number;
    conversionRate: number;
  };
  anticipation?: {
    nudgeImpressions: number;
    offerConversions: number;
    conversionRate: number;
    avgLagSeconds: number;
    byNudgeKind: Record<string, number>;
    byOfferResolution: Record<string, number>;
    daily?: Array<{
      date: string;
      nudgeImpressions: number;
      offerConversions: number;
    }>;
  };
};

export type OperatorFiscalDailyClosing = {
  closingId: string;
  locationId: string;
  locationName: string;
  businessDate: string;
  zNr: number | null;
  status: "closed" | "signed";
  totals: {
    grossCents: number;
    netCents: number;
    taxCents: number;
    cashCents: number;
    nonCashCents: number;
    tipsCents: number;
  };
  taxBreakdown: OperatorTaxBreakdownLine[];
  taxSummary: {
    breakdown: OperatorTaxBreakdownLine[];
    mwst19: OperatorTaxBreakdownLine | null;
    mwst7: OperatorTaxBreakdownLine | null;
  };
  paymentSummary: {
    cashCents: number;
    cardCents: number;
    onlineCents: number;
    otherCents: number;
  };
  orderCount: number;
  refundCount: number;
  refundTotalCents: number;
  tseSigned: boolean;
  closedAt: string;
  zBonPath: string;
};
