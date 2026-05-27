import type { MenuSection } from "@/lib/menu-section";

export type AiOrderFlowState = {
  /** Guest was asked once about food — do not ask again. */
  foodUpsellAsked?: boolean;
  /** Waiting for explicit yes/no on order recap before submit. */
  awaitingFinalConfirm?: boolean;
};

export type AiOrderDraft = {
  version: 1;
  items: AiDraftItem[];
  pending: AiPendingItem | null;
  cartRevision: number;
  updatedAt: string;
  flow?: AiOrderFlowState;
};

export type AiDraftItem = {
  productId: string;
  productName: string;
  quantity: number;
  modifierIds: string[];
  serveSize: string | null;
  notes: string;
  lineTotal: number;
  menuSection: MenuSection;
  productTaxRate: number | null;
};

export type AiPendingMissing =
  | { kind: "serveSize"; options: string[] }
  | {
      kind: "modifierGroup";
      groupId: string;
      groupName: string;
      minSelect: number;
      maxSelect: number;
      options: Array<{ id: string; name: string; price: number }>;
    };

export type AiPendingItem = {
  productId: string;
  productName: string;
  quantity: number;
  modifierIds: string[];
  notes: string;
  missing: AiPendingMissing[];
};

export type AiProposedItem = {
  productId: string;
  quantity: number;
  modifierIds: string[];
  serveSize: string | null;
  notes: string;
};

export type ValidatedCartAction = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  serveSize: string | null;
  menuSection: MenuSection;
  productTaxRate: number | null;
  modifiers: Array<{
    modifierId: string;
    modifierName: string;
    price: number;
  }>;
  lineTotal: number;
};

export function emptyOrderDraft(): AiOrderDraft {
  return {
    version: 1,
    items: [],
    pending: null,
    cartRevision: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function parseOrderDraft(value: unknown): AiOrderDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<AiOrderDraft>;
  if (row.version !== 1) return null;
  return {
    version: 1,
    items: Array.isArray(row.items) ? (row.items as AiDraftItem[]) : [],
    pending: (row.pending as AiPendingItem | null) ?? null,
    cartRevision: Number(row.cartRevision ?? 0),
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : new Date().toISOString(),
    flow:
      row.flow && typeof row.flow === "object" && !Array.isArray(row.flow)
        ? (row.flow as AiOrderFlowState)
        : undefined,
  };
}
