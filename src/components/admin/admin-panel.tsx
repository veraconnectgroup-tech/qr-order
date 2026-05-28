import {
  QrCard,
  QrCardDescription,
  QrCardTitle,
} from "@/components/design-system/qr-card";
import { cn } from "@/lib/utils";

export function AdminPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <QrCard className={cn("max-w-lg", className)}>
      <QrCardTitle className="text-base">{title}</QrCardTitle>
      {description ? <QrCardDescription>{description}</QrCardDescription> : null}
      <div className={description ? "mt-4" : "mt-3"}>{children}</div>
    </QrCard>
  );
}

export function AdminPanelSection({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/20 p-4",
        className
      )}
    >
      {children}
    </div>
  );
}
