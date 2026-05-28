export type GuestCommerceCommand =
  | { type: "SubmitFeedback"; payload: Record<string, unknown> }
  | { type: "RecordGoogleReviewClick"; payload: Record<string, unknown> }
  | { type: "InitiateReorder"; payload: Record<string, unknown> };

export type CommerceTrigger =
  | { kind: "payment_settled"; orderId: string }
  | { kind: "order_delivered"; orderId: string }
  | { kind: "session_bill_settled"; sessionId: string }
  | {
      kind: "guest_command";
      sessionId: string;
      command: GuestCommerceCommand;
      idempotencyKey: string;
    }
  | { kind: "floor_tick"; locationId: string; tickAt: string };

export type RunCommerceExperienceOpts = {
  idempotencyKey?: string;
  traceId?: string;
  /** Internal — actor worker must not re-enqueue. */
  skipActorEnqueue?: boolean;
};

export type RunCommerceExperienceResult = {
  eventId: string | null;
  skipped: boolean;
  reason?: string;
};
