/** Single-pass timeline fold — shared input for all posture dimensions (ADR-038 Val A). */
export type GuestMessageSignal = {
  text: string;
  at: number;
};

export type GuestDeclineSignal = {
  kind: "dismiss" | "explicit";
  at: number;
  nudgeKey?: string;
};

export type GuestBrowseChurnSignal = {
  productId: string;
  adds: number;
  removes: number;
};

export type GuestProactivePairSignal = {
  emittedAt: number;
  guestReplied: boolean;
};

export type GuestSignalSpine = {
  guestMessages: GuestMessageSignal[];
  declineSignals: GuestDeclineSignal[];
  browseChurn: GuestBrowseChurnSignal[];
  maxProductCartChurn: number;
  proactivePairs: GuestProactivePairSignal[];
  emittedProactiveKeys: string[];
  recommendationAsked: boolean;
  guestInitiatedBeforeDenis: boolean;
  actionTimestamps: number[];
};
