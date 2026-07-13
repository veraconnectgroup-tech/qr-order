import type { Database } from "@/types/database";

export type MissionRow = Database["public"]["Tables"]["denis_missions"]["Row"];
export type MissionKind = MissionRow["kind"];
export type MissionAssignedRole = NonNullable<MissionRow["assigned_role"]>;
export type MissionPriority = MissionRow["priority"];

export type MissionDraft = {
  kind: MissionKind;
  orgId: string;
  locationId: string;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
  assignedStaffId?: string | null;
  assignedRole?: MissionAssignedRole | null;
  tableId?: string | null;
  aiSessionId?: string | null;
  priority?: MissionPriority;
  slaMinutes?: number | null;
};
