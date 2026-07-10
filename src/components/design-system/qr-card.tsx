import { createElement, type ComponentProps, type ElementType } from "react";
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

  // createElement, not JSX, for the polymorphic "as" element — JSX's
  // LibraryManagedAttributes checking can't verify props against an
  // arbitrary generic T (a known TS limitation), and createElement's
  // looser overload accepts it without losing runtime behavior.
  return createElement(
    Component,
    {
      className: cn(
        "rounded-xl border border-border shadow-[var(--shadow-card)]",
        variantClasses[variant],
        paddingClasses[padding],
        className
      ),
      ...props,
    },
    children
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
