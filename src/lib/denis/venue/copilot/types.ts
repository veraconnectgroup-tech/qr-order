import type { FloorTableHint } from "@/lib/denis/venue/floor/types";
import type {
  KdsStressLevel,
  VenueOperatingMode,
} from "@/lib/denis/venue/ops/types";

export type StaffCopilotTableRow = {
  tableId: string;
  tableName: string;
  operatingHint: FloorTableHint;
  openOrderCount: number;
  seatedMinutes: number | null;
  hasActiveSession: boolean;
  staffHint: {
    text: string;
    visibility: "denis_only" | "guest_safe";
  } | null;
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
  canManageOps: boolean;
  canSetTableHints: boolean;
  priorityTables: StaffCopilotTableRow[];
  tables: StaffCopilotTableRow[];
};
