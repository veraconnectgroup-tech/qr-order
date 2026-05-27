export const COMMERCE_COMMAND_TYPES = {
  recordPaymentSettled: "RecordPaymentSettled",
  recordOrderDelivered: "RecordOrderDelivered",
  recordSessionBillSettled: "RecordSessionBillSettled",
  submitFeedback: "SubmitFeedback",
  recordGoogleReviewClick: "RecordGoogleReviewClick",
  initiateReorder: "InitiateReorder",
  recordTipSelection: "RecordTipSelection",
  acknowledgeCapacity: "AcknowledgeCapacity",
} as const;

export type CommerceCommandType =
  (typeof COMMERCE_COMMAND_TYPES)[keyof typeof COMMERCE_COMMAND_TYPES];

export const COMMERCE_EVENT_TYPES = {
  paymentSettled: "payment.settled",
  orderDelivered: "order.delivered",
  sessionBillSettled: "session.bill_settled",
  feedbackSubmitted: "feedback.submitted",
  reviewGoogleClicked: "review.google_clicked",
  reorderInitiated: "reorder.initiated",
  tipSelected: "tip.selected",
  capacityLevelChanged: "capacity.level_changed",
  preorderScheduled: "preorder.scheduled",
} as const;

export type CommerceEventType =
  (typeof COMMERCE_EVENT_TYPES)[keyof typeof COMMERCE_EVENT_TYPES];

export const COMMERCE_OUTBOX_TYPES = {
  projectionRefresh: "commerce.projection.refresh",
  alertStaff: "commerce.alert.staff",
  memorySync: "commerce.memory.sync",
  analyticsRollup: "commerce.analytics.rollup",
  preorderRelease: "commerce.preorder.release",
} as const;
