import { cn } from "@/lib/utils";

type DashboardPageProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Content spans edge-to-edge within the main area (menu editor, tables). */
  bleed?: boolean;
  className?: string;
};

export function DashboardPage({
  title,
  description,
  children,
  bleed = false,
  className,
}: DashboardPageProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        bleed ? "gap-4" : "gap-8",
        className
      )}
    >
      {(title || description) && (
        <div className="border-b border-dash-border-subtle pb-5">
          {title ? (
            <h1 className="text-2xl font-semibold tracking-tight text-dash-text">
              {title}
            </h1>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-dash-text-muted">{description}</p>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "min-w-0",
          bleed &&
            "-mx-5 -mb-5 flex min-h-0 flex-1 flex-col md:-mx-8 md:-mb-6"
        )}
      >
        {children}
      </div>
    </div>
  );
}
