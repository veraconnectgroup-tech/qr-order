export type FunnelStageKey =
  | "scan_qr"
  | "open_menu"
  | "browse"
  | "add_to_cart"
  | "order"
  | "pay";

export type ConversionFunnelStep = {
  stage: FunnelStageKey;
  label: string;
  count: number;
  pctOfPrevious: number | null;
  pctOfTotal: number;
  dropOffPct: number | null;
};

export type ConversionFunnelSnapshot = {
  steps: ConversionFunnelStep[];
  cartAbandonmentRate: number;
  biggestDropOffStage: FunnelStageKey | null;
};

export type MenuPerformanceRow = {
  productId: string;
  name: string;
  orderCount: number;
  revenue: number;
  prepTimeMinutes: number | null;
  profitMarginPct: number | null;
  satisfactionPct: number | null;
  returnRatePct: number | null;
  suggestion: string | null;
  rank: number;
};

export type MenuPerformanceMatrixSnapshot = {
  items: MenuPerformanceRow[];
  boostCandidates: MenuPerformanceRow[];
};

export type TimeGranularity = "hour" | "day" | "week" | "month";

export type TimeSeriesPoint = {
  label: string;
  revenue: number;
  orders: number;
};

export type TimeAnalyticsSnapshot = {
  byHour: TimeSeriesPoint[];
  byDay: TimeSeriesPoint[];
  byWeek: TimeSeriesPoint[];
  byMonth: TimeSeriesPoint[];
  busiestHours: Array<{ hour: string; orders: number; revenue: number }>;
  slowestHours: Array<{ hour: string; orders: number; revenue: number }>;
  staffSuggestions: StaffSchedulingSuggestion[];
};

export type StaffSchedulingSuggestion = {
  dayLabel: string;
  hourRange: string;
  suggestedWaiters: number;
  currentWaiters: number;
  reason: string;
};

export type DenisUpsellKindRow = {
  kind: string;
  impressions: number;
  conversions: number;
  successRate: number;
};

export type DenisPerformanceSnapshot = {
  upsellByNudgeKind: DenisUpsellKindRow[];
  languageAccuracyPct: number;
  handoffRate: number;
  avgResponseMs: number | null;
  conversionRate: number;
};

export type CompetitorBenchmarkSnapshot = {
  industryAvgTicket: number;
  venueAvgTicket: number;
  ticketDeltaPct: number;
  industryConversionRate: number;
  venueConversionRate: number;
  conversionDeltaPct: number;
  industryCartAbandonmentRate: number;
  venueCartAbandonmentRate: number;
  summary: string;
};

export type AdminIntelligenceSnapshot = {
  locationId: string;
  from: string;
  to: string;
  funnel: ConversionFunnelSnapshot;
  menuMatrix: MenuPerformanceMatrixSnapshot;
  timeAnalytics: TimeAnalyticsSnapshot;
  denisPerformance: DenisPerformanceSnapshot;
  competitorBenchmark: CompetitorBenchmarkSnapshot;
};
