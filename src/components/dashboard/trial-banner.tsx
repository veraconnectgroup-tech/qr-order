"use client";

import Link from "next/link";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt);
  const diff = end.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function TrialBanner() {
  const { trialEndsAt, onboardingCompleted, staffRole } = useDashboard();

  if (!onboardingCompleted) return null;
  if (!["owner", "manager"].includes(staffRole)) return null;
  if (!trialEndsAt) return null;

  const daysLeft = trialDaysLeft(trialEndsAt);
  if (daysLeft === null) return null;

  const expired = daysLeft <= 0;
  const message = expired
    ? "Trial expired — Upgrade"
    : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial`;

  return (
    <div
      role="region"
      aria-label="Trial status"
      className={`border-b px-4 py-2 text-center text-sm ${
        expired
          ? "border-red-500/30 bg-red-500/10 text-red-200"
          : "border-amber-500/30 bg-amber-500/10 text-amber-100"
      }`}
    >
      <span>{message}</span>
      {expired && (
        <Link
          href="mailto:hello@qrorder.app?subject=QR%20Order%20upgrade"
          className="ms-2 font-semibold underline underline-offset-2"
        >
          Contact us
        </Link>
      )}
    </div>
  );
}
