import { TRIAL_DURATION_DAYS } from "@/lib/billing/tiers";

export { TRIAL_DURATION_DAYS };

export function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isTrialing(subscriptionStatus: string | null | undefined): boolean {
  return (subscriptionStatus ?? "trialing") === "trialing";
}

/** Notify when trial has ≤3 days remaining (full features during 14-day trial). */
export function shouldNotifyTrialEnding(
  trialEndsAt: string | null,
  subscriptionStatus: string | null | undefined
): boolean {
  if (!isTrialing(subscriptionStatus)) return false;
  const days = trialDaysLeft(trialEndsAt);
  return days !== null && days > 0 && days <= 3;
}

export function buildTrialEndingGuestMessage(daysLeft: number): string {
  const days =
    daysLeft === 1 ? "1 dan" : daysLeft <= 4 ? `${daysLeft} dana` : `${daysLeft} dana`;
  return `Ostalo vam je ${days} trial-a! Upgrade za nastavak.`;
}

export function buildTrialEndingStaffBody(daysLeft: number): string {
  return `${buildTrialEndingGuestMessage(daysLeft)} Manage plan in Billing.`;
}

export function buildTrialEndingNotification(daysLeft: number) {
  return {
    title: "Denis trial ending soon",
    body: buildTrialEndingStaffBody(daysLeft),
    url: "/dashboard/billing",
  };
}
