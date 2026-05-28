import {
  QrCard,
  QrCardDescription,
  QrCardTitle,
} from "@/components/design-system/qr-card";

export const ORANGE = "#f97316";
export const ZINC_500 = "#71717a";
export const ZINC_700 = "#3f3f46";
export const EMERALD_500 = "#10b981";
export const BLUE_500 = "#3b82f6";

export const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#171717",
};

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <QrCard className={className}>
      <div className="mb-4">
        <QrCardTitle>{title}</QrCardTitle>
        {description ? <QrCardDescription>{description}</QrCardDescription> : null}
      </div>
      {children}
    </QrCard>
  );
}
