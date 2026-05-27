export type ShadowLegacyTurn = {
  intent?: string;
  message?: string;
  cartActionCount?: number;
  submitOrder?: boolean;
};

export type ShadowDenisTurn = {
  topGoal?: string | null;
  flowNodeId?: string;
  skillIds?: string[];
  hasConflict?: boolean;
  lintPassed?: boolean;
  intent?: string | null;
};

export type ShadowDiffResult = {
  parityScore: number;
  matched: string[];
  mismatches: string[];
};
