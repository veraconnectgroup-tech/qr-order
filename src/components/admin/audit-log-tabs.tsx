import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "audit", label: "Audit log" },
  { id: "dlq", label: "Dead letter queue" },
] as const;

export type AuditLogTab = (typeof tabs)[number]["id"];

export function AuditLogTabs({ active }: { active: AuditLogTab }) {
  return (
    <nav className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`/admin/audit-log?tab=${tab.id}`}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            active === tab.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
