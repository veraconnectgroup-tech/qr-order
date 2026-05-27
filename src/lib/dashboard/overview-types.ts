export type OverviewSparklinePoint = {
  date: string;
  revenue: number;
  isToday: boolean;
  label: string;
};

export type OverviewLiveFeedOrder = {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
  table_name: string;
};

export type OverviewTableStatus = {
  id: string;
  name: string;
  status: "available" | "occupied" | "payment";
  sessionTotal?: number;
  zoneId?: string | null;
  zoneName?: string | null;
};

export type OverviewStatsSnapshot = {
  todayRevenue: number;
  todayOrderCount: number;
  todayAvgTicket: number;
  yesterdayRevenue: number;
  yesterdayOrderCount: number;
  yesterdayAvgTicket: number;
  activeSessions: number;
  totalTables: number;
  pendingWaiterCalls: number;
};

export type DashboardOverviewInitialData = {
  stats: OverviewStatsSnapshot;
  liveFeed: OverviewLiveFeedOrder[];
  sparkline: OverviewSparklinePoint[];
  tableStatuses: OverviewTableStatus[];
};
