import type {
  ConnectorCategory,
  ConnectorStatus,
} from "@/lib/integrations/registry";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  pos: "Kasa / porudžbine",
  delivery: "Dostava",
  reservation: "Rezervacije",
  payment: "Plaćanje",
  accounting: "Računovodstvo",
};

const CATEGORY_ORDER: ConnectorCategory[] = [
  "pos",
  "delivery",
  "reservation",
  "payment",
  "accounting",
];

function StatusBadge({ status }: { status: ConnectorStatus }) {
  if (status.state === "connected") {
    return (
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          status.healthy
            ? "bg-green-50 text-green-700"
            : "bg-amber-50 text-amber-700"
        )}
      >
        {status.healthy ? "DA · povezano" : "DA · greška"}
      </span>
    );
  }
  if (status.state === "not_built") {
    return (
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        NE · nije napravljeno
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      NE · nije povezano
    </span>
  );
}

export function DenisIntegrationsMatrix({
  statuses,
}: {
  statuses: ConnectorStatus[];
}) {
  return (
    <div className="space-y-6">
      {CATEGORY_ORDER.map((category) => {
        const rows = statuses.filter((s) => s.category === category);
        if (rows.length === 0) return null;

        return (
          <section key={category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="divide-y rounded-xl border border-border">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {row.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.description}
                    </p>
                    {row.state === "connected" && row.lastError && (
                      <p className="mt-1 text-xs text-red-600">
                        Poslednja greška: {row.lastError}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={row} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
