"use client";

import { GuestErrorBoundary } from "@/components/error/guest-error-boundary";

export function GuestResilienceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuestErrorBoundary>{children}</GuestErrorBoundary>;
}
