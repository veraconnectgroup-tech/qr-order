import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";
import type { MenuSection } from "@/lib/menu-section";

export type StationQueue = {
  station: MenuSection | "bar" | "kitchen" | "dessert";
  activeOrderCount: number;
  avgWaitMinutes: number | null;
  oldestOrderMinutes: number | null;
  openOrderCount?: number;
  backlogMinutes?: number | null;
};

export type FloorTableHint =
  | "needs_attention"
  | "ready_for_dessert"
  | "idle"
  | null;

export type FloorGraphTable = {
  tableId: string;
  tableSessionId: string | null;
  seatedMinutes: number | null;
  openOrderCount: number;
  lastGuestActivityAt: string | null;
  aiSessionId: string | null;
  operatingHint: FloorTableHint;
};

export type FloorGraphHouse = {
  operatingMode: VenueOperatingMode;
  kdsBacklogMinutes: number | null;
  activeOrderCount: number;
  staffOnFloor: number | null;
  stationQueues?: StationQueue[];
  houseHint?: string | null;
};

export type FloorGraph = {
  locationId: string;
  at: string;
  tables: FloorGraphTable[];
  house: FloorGraphHouse;
};
