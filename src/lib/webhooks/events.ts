export const WEBHOOK_EVENTS = [
  "order.created",
  "order.paid",
  "order.status_changed",
  "order.cancelled",
  "order.refunded",
  "session.opened",
  "session.closed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "order.created": "Order created",
  "order.paid": "Order paid",
  "order.status_changed": "Order status changed",
  "order.cancelled": "Order cancelled",
  "order.refunded": "Order refunded",
  "session.opened": "Session opened",
  "session.closed": "Session closed",
};
