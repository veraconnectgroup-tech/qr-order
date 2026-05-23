"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function OnboardingGuard({
  onboardingCompleted,
  children,
}: {
  onboardingCompleted: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onSetup = pathname.startsWith("/dashboard/setup");

  useEffect(() => {
    if (!onboardingCompleted && !onSetup) {
      router.replace("/dashboard/setup");
      return;
    }
    if (onboardingCompleted && onSetup) {
      router.replace("/dashboard/orders");
    }
  }, [onboardingCompleted, onSetup, router]);

  if (!onboardingCompleted && !onSetup) {
    return null;
  }

  if (onboardingCompleted && onSetup) {
    return null;
  }

  return children;
}
