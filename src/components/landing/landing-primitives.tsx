import { cn } from "@/lib/utils";

export function LandingContainer({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "landing-container mx-auto w-full px-6",
        wide ? "max-w-[1280px]" : "max-w-[1120px]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function LandingEyebrow({
  children,
  className,
  inverted,
}: {
  children: React.ReactNode;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.16em]",
        inverted ? "text-[var(--lp-subtle)]" : "text-[var(--lp-accent)]",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Raycast-style centered label with flanking rules */
export function LandingSectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-4 sm:gap-5", className)}>
      <span
        className="h-px w-10 bg-gradient-to-r from-transparent via-[var(--lp-border)] to-[var(--lp-border)] sm:w-14"
        aria-hidden
      />
      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--lp-subtle)]">
        {children}
      </span>
      <span
        className="h-px w-10 bg-gradient-to-l from-transparent via-[var(--lp-border)] to-[var(--lp-border)] sm:w-14"
        aria-hidden
      />
    </div>
  );
}

export function LandingHeadline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** Legacy prop from the dark theme — headlines now always use ink. */
  inverted?: boolean;
}) {
  return (
    <h2
      className={cn(
        "font-display text-[clamp(1.875rem,3.8vw,2.875rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--lp-ink)]",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function LandingLead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** Legacy prop from the dark theme — leads now always use muted ink. */
  inverted?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[16px] leading-[1.75] tracking-[-0.01em] text-[var(--lp-muted)]",
        className
      )}
    >
      {children}
    </p>
  );
}

export function LandingSection({
  children,
  className,
  id,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  variant?: "default" | "surface" | "tint" | "dark" | "warm";
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24",
        variant === "default" && "bg-[var(--lp-bg)]",
        variant === "surface" && "bg-[var(--lp-surface)]",
        variant === "tint" && "bg-[var(--lp-tint)]",
        variant === "warm" && "bg-[var(--lp-warm)]",
        variant === "dark" && "bg-[var(--lp-dark)] text-white",
        className
      )}
    >
      {children}
    </section>
  );
}
