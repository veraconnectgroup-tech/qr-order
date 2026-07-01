import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { guestTextFromTimeline } from "@/lib/denis/cognition/conversation/guest-continuity";
import { isGuestDeclineMessage } from "@/lib/denis/cognition/tde/semantic-intent-router";
import {
  buildNudgeId,
  NUDGE_ACCEPT_WINDOW_SEC,
  NUDGE_RESOLVE_WINDOW_SEC,
  type NudgeOutcomeKind,
  type NudgeOutcomeRecord,
  type NudgeResolutionSignal,
  type PendingNudge,
} from "@/lib/denis/cognition/offer/nudge-outcome-types";
import type { OfferResolutionKind } from "@/lib/denis/cognition/offer/offer-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function isBrowseEvent(row: DenisTimelineRow): BrowseEvent | null {
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return null;
  if ((payload as { type?: string }).type !== "perception.ingested") return null;
  const frame = (payload as { frame?: { channel?: string } }).frame;
  if (frame?.channel !== "telemetry.browse") return null;
  const event = (payload as { browseEvent?: BrowseEvent }).browseEvent;
  if (!event || typeof event !== "object") return null;
  return event;
}

function readResolution(value: unknown): OfferResolutionKind | null {
  if (typeof value !== "string") return null;
  const allowed: OfferResolutionKind[] = [
    "top_dwell",
    "return_view",
    "cart_recovery",
    "kitchen_alternative",
    "category_affinity",
  ];
  return allowed.includes(value as OfferResolutionKind)
    ? (value as OfferResolutionKind)
    : null;
}

function readDismissedKeys(row: DenisTimelineRow): string[] {
  if (row.event_type !== "realtime.ingested") return [];
  const inner = asRecord(row.payload).payload;
  if (!inner || typeof inner !== "object") return [];
  const dismissed = (inner as { dismissedNudgeKeys?: unknown }).dismissedNudgeKeys;
  if (!Array.isArray(dismissed)) return [];
  return dismissed.filter((key): key is string => typeof key === "string" && key.trim().length > 0);
}

function nudgeMatchesDismiss(pending: PendingNudge, dismissedKey: string): boolean {
  const key = dismissedKey.trim();
  if (!key) return false;
  if (key === pending.nudgeKind) return true;
  if (key === pending.nudgeId) return true;
  return key.startsWith(`${pending.nudgeKind}:`);
}

type TimelineEvent =
  | { atMs: number; at: string; kind: "accept"; productId: string }
  | { atMs: number; at: string; kind: "decline_explicit" }
  | { atMs: number; at: string; kind: "decline_dismiss"; dismissKey: string }
  | { atMs: number; at: string; kind: "ignored_message" };

function collectTimelineEvents(rows: DenisTimelineRow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const row of rows) {
    const atMs = new Date(row.created_at).getTime();
    const at = row.created_at;

    for (const dismissKey of readDismissedKeys(row)) {
      events.push({ atMs, at, kind: "decline_dismiss", dismissKey });
    }

    const guestText = guestTextFromTimeline(row);
    if (guestText) {
      if (isGuestDeclineMessage(guestText)) {
        events.push({ atMs, at, kind: "decline_explicit" });
      } else {
        events.push({ atMs, at, kind: "ignored_message" });
      }
    }

    const browseEvent = isBrowseEvent(row);
    if (
      browseEvent?.action === "add_to_cart" &&
      typeof browseEvent.productId === "string" &&
      browseEvent.productId.trim()
    ) {
      events.push({
        atMs,
        at: browseEvent.timestamp || at,
        kind: "accept",
        productId: browseEvent.productId,
      });
    }
  }

  return events.sort((a, b) => a.atMs - b.atMs);
}

function resolvePendingNudge(
  pending: PendingNudge,
  events: TimelineEvent[],
  nowMs: number
): NudgeOutcomeRecord | null {
  const acceptDeadline = pending.emittedMs + NUDGE_ACCEPT_WINDOW_SEC * 1000;
  const resolveDeadline = pending.emittedMs + NUDGE_RESOLVE_WINDOW_SEC * 1000;

  for (const event of events) {
    if (event.atMs < pending.emittedMs) continue;

    if (event.kind === "accept" && pending.productId && event.productId === pending.productId) {
      if (event.atMs > acceptDeadline) continue;
      return finalizeOutcome(pending, {
        outcome: "accepted",
        signal: "add_to_cart",
        resolvedAt: event.at,
        lagMs: Math.max(0, event.atMs - pending.emittedMs),
      });
    }

    if (event.atMs > resolveDeadline) break;

    if (event.kind === "decline_explicit") {
      return finalizeOutcome(pending, {
        outcome: "declined",
        signal: "explicit_decline",
        resolvedAt: event.at,
        lagMs: Math.max(0, event.atMs - pending.emittedMs),
      });
    }

    if (event.kind === "decline_dismiss" && nudgeMatchesDismiss(pending, event.dismissKey)) {
      return finalizeOutcome(pending, {
        outcome: "declined",
        signal: "dismiss",
        resolvedAt: event.at,
        lagMs: Math.max(0, event.atMs - pending.emittedMs),
      });
    }

    if (event.kind === "ignored_message") {
      return finalizeOutcome(pending, {
        outcome: "ignored",
        signal: "guest_message_unrelated",
        resolvedAt: event.at,
        lagMs: Math.max(0, event.atMs - pending.emittedMs),
      });
    }
  }

  if (nowMs >= resolveDeadline) {
    return finalizeOutcome(pending, {
      outcome: "expired",
      signal: "timeout",
      resolvedAt: new Date(resolveDeadline).toISOString(),
      lagMs: null,
    });
  }

  return null;
}

function finalizeOutcome(
  pending: PendingNudge,
  input: {
    outcome: NudgeOutcomeKind;
    signal: NudgeResolutionSignal;
    resolvedAt: string;
    lagMs: number | null;
  }
): NudgeOutcomeRecord {
  return {
    nudgeId: pending.nudgeId,
    nudgeKind: pending.nudgeKind,
    outcome: input.outcome,
    signal: input.signal,
    productId: pending.productId,
    productName: pending.productName,
    offerResolution: pending.offerResolution,
    emittedAt: pending.emittedAt,
    resolvedAt: input.resolvedAt,
    lagMs: input.lagMs,
  };
}

function readLoggedOutcomeIds(timeline: DenisTimelineRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of timeline) {
    if (row.event_type !== "anticipation.resolved") continue;
    const payload = asRecord(row.payload);
    if (payload.type !== "anticipation.resolved") continue;
    const nudgeId = payload.nudgeId;
    if (typeof nudgeId === "string" && nudgeId.trim()) {
      ids.add(nudgeId.trim());
    }
  }
  return ids;
}

/** Pure fold — full nudge lifecycle from timeline (ADR-039 L1). */
export function foldNudgeOutcomes(
  timeline: DenisTimelineRow[],
  nowMs = Date.now()
): {
  outcomes: NudgeOutcomeRecord[];
  pending: PendingNudge[];
  sessionAttachRate: number;
} {
  const logged = readLoggedOutcomeIds(timeline);
  const events = collectTimelineEvents(timeline);
  const outcomes: NudgeOutcomeRecord[] = [];
  const pending: PendingNudge[] = [];

  for (const row of timeline) {
    if (row.event_type !== "proactive.emitted") continue;

    const payload = asRecord(row.payload);
    const kind = typeof payload.kind === "string" ? payload.kind.trim() : "";
    if (!kind) continue;

    const emittedMs = new Date(row.created_at).getTime();
    const productId =
      typeof payload.productId === "string" && payload.productId.trim()
        ? payload.productId.trim()
        : null;
    const nudgeId = buildNudgeId({
      kind,
      productId,
      emittedAt: row.created_at,
      dedupeKey: typeof payload.dedupeKey === "string" ? payload.dedupeKey : null,
    });

    if (logged.has(nudgeId)) continue;

    const pendingNudge: PendingNudge = {
      nudgeId,
      nudgeKind: kind,
      productId,
      productName:
        typeof payload.productName === "string" ? payload.productName : null,
      offerResolution: readResolution(payload.offerResolution),
      emittedAt: row.created_at,
      emittedMs,
    };

    const resolved = resolvePendingNudge(pendingNudge, events, nowMs);
    if (resolved) {
      outcomes.push(resolved);
    } else {
      pending.push(pendingNudge);
    }
  }

  const terminal = [...outcomes];
  for (const row of timeline) {
    if (row.event_type !== "anticipation.resolved") continue;
    const payload = asRecord(row.payload);
    if (payload.type !== "anticipation.resolved") continue;
    terminal.push({
      nudgeId: String(payload.nudgeId ?? ""),
      nudgeKind: String(payload.nudgeKind ?? "unknown"),
      outcome: payload.outcome as NudgeOutcomeKind,
      signal: payload.signal as NudgeResolutionSignal,
      productId:
        typeof payload.productId === "string" ? payload.productId : null,
      productName:
        typeof payload.productName === "string" ? payload.productName : null,
      offerResolution: readResolution(payload.offerResolution),
      emittedAt: String(payload.emittedAt ?? row.created_at),
      resolvedAt: String(payload.resolvedAt ?? row.created_at),
      lagMs:
        typeof payload.lagMs === "number" && Number.isFinite(payload.lagMs)
          ? payload.lagMs
          : null,
    });
  }

  const uniqueTerminal = new Map<string, NudgeOutcomeRecord>();
  for (const outcome of terminal) {
    if (!outcome.nudgeId) continue;
    uniqueTerminal.set(outcome.nudgeId, outcome);
  }
  const resolvedOutcomes = [...uniqueTerminal.values()].sort(
    (a, b) => new Date(a.emittedAt).getTime() - new Date(b.emittedAt).getTime()
  );

  const accepted = resolvedOutcomes.filter((row) => row.outcome === "accepted").length;
  const sessionAttachRate =
    resolvedOutcomes.length === 0 ? 0 : accepted / resolvedOutcomes.length;

  return {
    outcomes: resolvedOutcomes,
    pending,
    sessionAttachRate,
  };
}
