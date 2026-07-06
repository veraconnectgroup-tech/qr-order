import { cn } from "@/lib/utils";

type AdminPageProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function AdminPage({
  title,
  description,
  children,
  className,
}: AdminPageProps) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-8", className)}>
      {(title || description) && (
        <div className="border-b border-border pb-5">
          {title ? (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
