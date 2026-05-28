import type {
  FloorTileStatus,
  FloorTileTableInput,
} from "@/components/design-system/floor-tile.types";

export type TableTileStatusInput = FloorTileTableInput;

export function tableTileStatus(table: TableTileStatusInput): FloorTileStatus {
  if (table.hasWaiterCall) return "attention";
  if (table.hasPaymentRequest) return "payment";
  if (table.session || table.activeOrders.length > 0) return "occupied";
  return "available";
}

export const floorTileStatusFromTable = tableTileStatus;
