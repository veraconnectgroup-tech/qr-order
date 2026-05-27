import Link from "next/link";
import type { ReactNode } from "react";
import { AuthShowcasePanel } from "@/components/auth/auth-showcase-panel";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { QrCard } from "@/components/design-system/qr-card";
import { cn } from "@/lib/utils";

export function AuthShell({
  title,
  description,
  error,
  children,
  className,
}: {
  title: string;
  description?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="dashboard-theme flex min-h-screen bg-background text-foreground">
      <aside className="relative hidden w-[52%] max-w-[720px] shrink-0 border-r border-border lg:flex">
        <AuthShowcasePanel />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-border px-5 py-4 lg:hidden">
          <Link href="/" className="inline-flex">
            <DenisBrandMark markOnly markSize={24} />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-10 lg:px-8 lg:py-12">
          <QrCard variant="muted" className={cn("w-full max-w-sm", className)}>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </p>
            ) : null}
            {children}
          </QrCard>
        </div>
      </div>
    </div>
  );
}
