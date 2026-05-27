import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";

export type CartConflict =
  | { kind: "duplicate_line"; ai: DenisCartLine; manual: DenisCartLine }
  | { kind: "ai_only"; line: DenisCartLine }
  | { kind: "manual_only"; line: DenisCartLine }
  | { kind: "price_drift"; productId: string; productName: string; expected: number; actual: number };

export type ResolutionStrategy =
  | "prefer_ai_for_submit"
  | "offer_merge_recap"
  | "manual_authoritative";

export type UnifiedCartView = {
  aiLines: DenisCartLine[];
  manualLines: DenisCartLine[];
  /** Hypothetical merge if guest confirms — never applied silently. */
  proposedMerge: DenisCartLine[] | null;
  summary: string;
};

export type ConflictResolution = {
  conflicts: CartConflict[];
  strategy: ResolutionStrategy;
  guestPrompt: string | null;
  unifiedView: UnifiedCartView;
  hasConflict: boolean;
};
