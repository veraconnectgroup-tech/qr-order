import type { ComponentProps, ElementType } from "react";
import { cn } from "@/lib/utils";

type QrCardVariant = "default" | "muted";
type QrCardPadding = "none" | "sm" | "md" | "lg";

const variantClasses: Record<QrCardVariant, string> = {
  default: "bg-card",
  muted: "bg-card/50",
};

const paddingClasses: Record<QrCardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export type QrCardProps<T extends ElementType = "div"> = {
  as?: T;
  variant?: QrCardVariant;
  padding?: QrCardPadding;
} & Omit<ComponentProps<T>, "as">;

export function QrCard<T extends ElementType = "div">({
  as,
  className,
  children,
  variant = "default",
  padding = "lg",
  ...props
}: QrCardProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn(
        "rounded-xl border border-border shadow-[var(--shadow-card)]",
        variantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function QrCardTitle({
  className,
  children,
  ...props
}: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function QrCardHeading({
  className,
  children,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-sm font-semibold text-dash-text-secondary", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function QrCardDescription({
  className,
  children,
  ...props
}: ComponentProps<"p">) {
  return (
    <p className={cn("mt-1 text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}
