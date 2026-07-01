/** Client-side accessibility hints from the guest browser (ingress-safe). */
export type ClientAccessibilitySignals = {
  screenReader?: boolean;
  browserZoom?: number;
  prefersReducedMotion?: boolean;
  voiceInput?: boolean;
  /** Touch-primary device — larger tap targets (motor). */
  coarsePointer?: boolean;
};
