import {
  buildDenisToneGuide,
  buildLevelUpNudge,
  buildNextLevelProgress,
  detectLevelUp,
  resolveGuestLevel,
  type GuestLevelId,
} from "@/lib/denis/commerce/loyalty/guest-level";
import { detectStreak } from "@/lib/denis/commerce/loyalty/streak-tracker";

export type LoyaltyContextInput = {
  visitCount: number;
  totalSpent: number;
  pointsBalance: number;
  visitDates?: string[];
  previousLevel?: GuestLevelId;
  lastVisitItemNames?: string[];
  language?: string;
};

export type LoyaltyContextSnapshot = {
  guestLevel: GuestLevelId;
  levelName: string;
  levelBadge: string;
  pointsBalance: number;
  streakCount: number;
  streakLabel: string;
  streakMultiplier: number;
  nextLevelProgress: ReturnType<typeof buildNextLevelProgress>;
  levelUpNudge: string | null;
  levelUpEvent: ReturnType<typeof detectLevelUp>;
  toneGuide: string;
};

export function buildLoyaltyContextSnapshot(
  input: LoyaltyContextInput
): LoyaltyContextSnapshot {
  const level = resolveGuestLevel({
    visitCount: input.visitCount,
    totalSpent: input.totalSpent,
  });
  const streak = detectStreak(input.visitDates ?? []);
  const nextLevelProgress = buildNextLevelProgress({
    visitCount: input.visitCount,
    totalSpent: input.totalSpent,
  });
  const levelUpEvent =
    input.previousLevel != null
      ? detectLevelUp(input.previousLevel, {
          visitCount: input.visitCount,
          totalSpent: input.totalSpent,
        })
      : null;

  return {
    guestLevel: level.id,
    levelName: level.name,
    levelBadge: level.badge,
    pointsBalance: input.pointsBalance,
    streakCount: streak.visitCountInWindow,
    streakLabel: streak.label,
    streakMultiplier: streak.multiplier,
    nextLevelProgress,
    levelUpNudge: buildLevelUpNudge(
      { visitCount: input.visitCount, totalSpent: input.totalSpent },
      input.language
    ),
    levelUpEvent,
    toneGuide: buildDenisToneGuide(level),
  };
}

export function buildLoyaltyContextBlock(input: LoyaltyContextInput): string {
  const snapshot = buildLoyaltyContextSnapshot(input);
  const progress = snapshot.nextLevelProgress;

  const lines = [
    "LOYALTY CONTEXT:",
    `- guest_level: ${snapshot.guestLevel} (${snapshot.levelName}) ${snapshot.levelBadge}`,
    `- points_balance: ${snapshot.pointsBalance}`,
    `- streak_count: ${snapshot.streakCount}${snapshot.streakLabel ? ` (${snapshot.streakLabel}, ${snapshot.streakMultiplier}× poeni)` : ""}`,
    `- next_level_progress: ${progress.progressPercent}%${progress.nextLevel ? ` → ${progress.nextLevel.name}` : " (max level)"}`,
    `- denis_tone: ${snapshot.toneGuide}`,
  ];

  if (snapshot.levelUpNudge) {
    lines.push(`- proactive_nudge: ${snapshot.levelUpNudge}`);
  }

  if (snapshot.levelUpEvent) {
    lines.push(
      `- level_up_celebration: YES — "${snapshot.levelUpEvent.celebrationMessage}" (trigger confetti)`
    );
  }

  const lastItems = input.lastVisitItemNames?.filter(Boolean).slice(0, 2);
  if (lastItems?.length && snapshot.guestLevel >= 2) {
    lines.push(`- last_visit_items: ${lastItems.join(", ")}`);
  }

  return lines.join("\n");
}

export function shouldTriggerLevelUpCelebration(
  input: LoyaltyContextInput
): boolean {
  if (input.previousLevel == null) return false;
  const event = detectLevelUp(input.previousLevel, {
    visitCount: input.visitCount,
    totalSpent: input.totalSpent,
  });
  return event != null;
}
