import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type {
  KdsStressLevel,
  VenueOperatingMode,
} from "@/lib/denis/venue/ops/types";

export type StaffCopilotTablePriority = "urgent" | "high" | "normal" | "idle";

export type StaffCopilotTableRow = {
  tableId: string;
  tableName: string;
  priority: StaffCopilotTablePriority;
  operatingHint: FloorTableHint;
  openOrderCount: number;
  seatedMinutes: number | null;
  hasActiveSession: boolean;
  guestWaitMinutes: number | null;
  staffHint: {
    text: string;
    visibility: "denis_only" | "guest_safe";
  } | null;
  staffBrief: string | null;
  revenueOpportunity: StaffRevenueOpportunity;
};

export type StaffCopilotSnapshot = {
  enabled: boolean;
  at: string;
  operatingMode: VenueOperatingMode;
  kdsStress: KdsStressLevel;
  kdsBacklogMinutes: number | null;
  activeOrderCount: number;
  floorGraphEnabled: boolean;
  autoRushEnabled: boolean;
  autoRushBacklogMinutes: number;
  rushModeSuggestion: string | null;
  canManageOps: boolean;
  canSetTableHints: boolean;
  priorityTables: StaffCopilotTableRow[];
  tables: StaffCopilotTableRow[];
  eventBlock: EventCopilotBlock | null;
  gatheringHint: string | null;
  /** Basket-analysis pairings discovered from order history (X1). */
  learnedPairingsBlock: EventCopilotBlock | null;
  inventoryBrief: string | null;
  /** Pre-shift briefing card (S14) — dashboard, not email. */
  prepBriefingBlock: EventCopilotBlock | null;
};

export type EventCopilotBlock = {
  title: string;
  lines: string[];
};

export type StaffActionPriority =
  | "fyi"
  | "normal"
  | "low"
  | "medium"
  | "high"
  | "urgent";

export type StaffRevenueOpportunity =
  | string
  | {
      title: string;
      amountCents?: number | null;
      priority?: StaffActionPriority;
    }
  | null;
