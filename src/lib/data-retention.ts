/** Centralized data retention policy (Layer 10 AG2). */
export const DATA_RETENTION = {
  aiSessions: {
    days: 90,
    condition: "status = 'completed'",
    note: "Completed AI chat sessions",
  },
  turnTraces: {
    days: 7,
    note: "Guest input in turn traces — GDPR",
  },
  webhookEvents: {
    days: 30,
    note: "Processed webhook event log",
  },
  guestMemory: {
    condition: "expires_at < now()",
    note: "Consent-scoped guest memory",
  },
  orders: {
    days: 730,
    note: "2 years — legal/fiscal requirement (DACH)",
  },
  auditLog: {
    days: 365,
    note: "1 year — compliance minimum",
  },
  orderEvents: {
    days: 730,
    note: "2 years — sensitive action journal (ADR-044 / GoBD context)",
  },
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function retentionCutoffIso(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}
