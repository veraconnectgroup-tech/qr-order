import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
