import type { ReactNode } from "react";

export type FloorTileVariant = "floor" | "kpi" | "chip";

export type FloorTileStatus =
  | "available"
  | "occupied"
  | "attention"
  | "payment"
  | "selected";

export type FloorTileElement = "button" | "a" | "div";

export type FloorTileTableInput = {
  hasWaiterCall: boolean;
  hasPaymentRequest: boolean;
  session: unknown | null;
  activeOrders: unknown[];
};

export type FloorTileProps = {
  variant?: FloorTileVariant;
  status?: FloorTileStatus;
  label: string;
  sublabel?: string;
  value?: string;
  highlight?: boolean;
  compact?: boolean;
  as?: FloorTileElement;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};
