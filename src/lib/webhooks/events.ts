export const COMMERCE_WEBHOOK_EVENTS = [
  "order.created",
  "order.paid",
  "order.status_changed",
  "order.cancelled",
  "order.refunded",
  "session.opened",
  "session.closed",
] as const;

export const DENIS_OPERATOR_WEBHOOK_EVENTS = [
  "denis.session.completed",
  "denis.session.converted",
  "denis.metrics.daily_ready",
  "denis.alert.conversion_drop",
  "denis.alert.credit_low",
  "denis.alert.circuit_open",
  "denis.config.proposal.created",
] as const;

export const WEBHOOK_EVENTS = [
  ...COMMERCE_WEBHOOK_EVENTS,
  ...DENIS_OPERATOR_WEBHOOK_EVENTS,
] as const;

export type CommerceWebhookEvent = (typeof COMMERCE_WEBHOOK_EVENTS)[number];
export type DenisOperatorWebhookEvent =
  (typeof DENIS_OPERATOR_WEBHOOK_EVENTS)[number];
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "order.created": "Order created",
  "order.paid": "Order paid",
  "order.status_changed": "Order status changed",
  "order.cancelled": "Order cancelled",
  "order.refunded": "Order refunded",
  "session.opened": "Session opened",
  "session.closed": "Session closed",
  "denis.session.completed": "Denis session completed",
  "denis.session.converted": "Denis session converted",
  "denis.metrics.daily_ready": "Denis daily metrics ready",
  "denis.alert.conversion_drop": "Denis conversion drop alert",
  "denis.alert.credit_low": "Denis credit low alert",
  "denis.alert.circuit_open": "Denis circuit open alert",
  "denis.config.proposal.created": "Denis config proposal created",
};

export function isDenisOperatorWebhookEvent(
  event: string
): event is DenisOperatorWebhookEvent {
  return (DENIS_OPERATOR_WEBHOOK_EVENTS as readonly string[]).includes(event);
}
