import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type {
  StaffActionPriority,
  StaffCopilotSnapshot,
  StaffCopilotTableRow,
} from "@/lib/denis/venue/copilot/types";

export type WaiterUrgency = "green" | "yellow" | "red";

export type WaiterCopilotTableRow = StaffCopilotTableRow & {
  summary: string;
  urgency: WaiterUrgency;
  suggestedAction: string | null;
  actionPriority: StaffActionPriority | null;
  guestWaitMinutes: number | null;
};

export type WaiterHandoffAlert = {
  id: string;
  tableId: string | null;
  tableName: string | null;
  type: string;
  priority: string;
  message: string;
  contextLine: string;
  actionUrl: string | null;
  createdAt: string;
};

export type WaiterCopilotSnapshot = Omit<
  StaffCopilotSnapshot,
  "priorityTables" | "tables"
> & {
  priorityTables: WaiterCopilotTableRow[];
  tables: WaiterCopilotTableRow[];
  handoffAlerts: WaiterHandoffAlert[];
};

export type WaiterSessionIntel = {
  allergyLabels: string[];
  frustrationLevel: "none" | "mild" | "high";
  cartSummary: string | null;
  guestTopics: string[];
};

export type WaiterDenisTimelineEntry = {
  at: string;
  message: string;
  tier: string | null;
};

export type WaiterDeviceOrderGroup = {
  deviceLabel: string;
  deviceFingerprint: string | null;
  orders: Array<{
    orderId: string;
    orderNumber: number;
    status: string;
    total: number;
    createdAt: string;
    items: Array<{ quantity: number; productName: string }>;
  }>;
};

export type WaiterTableSessionView = {
  tableId: string;
  tableName: string;
  enabled: boolean;
  summary: string | null;
  urgency: WaiterUrgency;
  suggestedAction: string | null;
  deviceOrders: WaiterDeviceOrderGroup[];
  denisTimeline: WaiterDenisTimelineEntry[];
};

export type WaiterOrderAssistSuggestion = {
  kind: "product" | "allergy_warning" | "pairing";
  label: string;
  detail: string | null;
  productId: string | null;
  severity: "info" | "warn" | "block" | null;
};

export type WaiterOrderAssistResult = {
  matches: WaiterOrderAssistSuggestion[];
  pairings: WaiterOrderAssistSuggestion[];
  allergyWarnings: WaiterOrderAssistSuggestion[];
};

export type WaiterTableSummaryInput = {
  operatingHint: FloorTableHint;
  guestWaitMinutes: number | null;
  frustrationLevel: WaiterSessionIntel["frustrationLevel"];
  allergyLabels: string[];
  hasWaiterCall: boolean;
};
