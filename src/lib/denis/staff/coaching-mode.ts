/** X3 — Denis conversation coaching for new staff (shadow / active modes). */

import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { SessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type CoachingHintPriority = "now" | "when_free" | "fyi";

export type CoachingHint = {
  trigger: string;
  suggestion: string;
  reasoning: string;
  priority: CoachingHintPriority;
  expiresInSeconds: number;
};

export type CoachingMode = "shadow" | "active";

export type CoachingSession = {
  staffId: string;
  mode: CoachingMode;
  hintsGiven: number;
  hintsFollowed: number;
  score: number;
};

const MAX_HINTS_PER_HOUR = 3;
const HINT_TTL_SECONDS = 300;

function minutesSince(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0;
  return (nowMs - Date.parse(iso)) / 60_000;
}

export function canGiveCoachingHint(session: CoachingSession): boolean {
  if (session.mode === "shadow") return true;
  return session.hintsGiven < MAX_HINTS_PER_HOUR;
}

export function scoreCoachingFollow(
  session: CoachingSession,
  followed: boolean
): CoachingSession {
  if (!followed || session.mode !== "active") {
    return { ...session, hintsGiven: session.hintsGiven + 1 };
  }
  return {
    ...session,
    hintsGiven: session.hintsGiven + 1,
    hintsFollowed: session.hintsFollowed + 1,
    score: Math.min(100, session.score + 10),
  };
}

export function generateCoachingHint(input: {
  tableState: TableSessionState;
  mental: GuestMentalModel | null;
  trajectory: SessionTrajectory | null;
  staffProximity: boolean;
  tableLabel?: string;
  sessionOpenedAt?: string | null;
  nowMs?: number;
}): CoachingHint | null {
  const nowMs = input.nowMs ?? Date.now();
  const table = input.tableLabel ?? input.tableState.table.name ?? "Sto";
  const orders = input.tableState.commerce.orders ?? [];
  const hasOrder = orders.length > 0;

  const browseMinutes = input.sessionOpenedAt
    ? minutesSince(input.sessionOpenedAt, nowMs)
    : input.tableState.browse.totalBrowseMs / 60_000;

  if (
    !hasOrder &&
    (input.mental?.intent === "exploring" || input.trajectory?.engagement === "lull") &&
    browseMinutes >= 3 &&
    !input.staffProximity
  ) {
    return {
      trigger: `gost gleda meni ${Math.floor(browseMinutes)}+ min`,
      suggestion: `${table}: pristupi i pitaj da li treba pomoć`,
      reasoning: "Denis bi ponudio browse nudge sada",
      priority: browseMinutes >= 4 ? "now" : "when_free",
      expiresInSeconds: HINT_TTL_SECONDS,
    };
  }

  const deliveredOrder = orders.find((order) => order.status === "delivered");
  if (deliveredOrder) {
    const sinceDelivered = minutesSince(
      deliveredOrder.deliveredAt ?? deliveredOrder.createdAt,
      nowMs
    );
    if (sinceDelivered >= 12 && !input.staffProximity) {
      return {
        trigger: `jelo servirano ${Math.floor(sinceDelivered)} min ago`,
        suggestion: `${table}: provjeri da li je sve OK`,
        reasoning: "Post-delivery check-in window",
        priority: "when_free",
        expiresInSeconds: HINT_TTL_SECONDS,
      };
    }
  }

  const frustration = input.mental?.affect.frustration.level ?? "none";
  if (frustration === "high") {
    return {
      trigger: "gost frustriran (ton, ponavljanje)",
      suggestion: `${table}: pristupi s empatijom`,
      reasoning:
        "Frustration recovery — Denis bi smanjio tempo i pitao šta ne valja",
      priority: "now",
      expiresInSeconds: HINT_TTL_SECONDS,
    };
  }

  const guest = input.tableState.guest;
  if (guest && guest.visitCount > 1 && guest.lastVisitItemNames.length > 0) {
    const prefs = guest.allergyLabels.length
      ? ` — voli bez ${guest.allergyLabels.join(", ")}`
      : "";
    const lastItems = guest.lastVisitItemNames.slice(0, 2).join(", ");
    return {
      trigger: "returning guest",
      suggestion: `${table}: returning guest — zadnji put ${lastItems}${prefs}`,
      reasoning: "Guest memory intel — personal touch",
      priority: "fyi",
      expiresInSeconds: HINT_TTL_SECONDS,
    };
  }

  return null;
}

export function formatWeeklyCoachingScore(
  session: CoachingSession,
  staffName: string
): string {
  const followRate =
    session.hintsGiven > 0
      ? Math.round((session.hintsFollowed / session.hintsGiven) * 100)
      : 0;
  return `${staffName}: ${session.score}/100 — follow rate ${followRate}%`;
}
