import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import type { SupabaseClient } from "@supabase/supabase-js";

type LiveOpsSnapshot = {
  activeTables: number;
  preparingOrders: number;
  delayedOrders: number;
  todayOrderCount: number;
  todaySessionCount: number;
};

export async function loadDenisLiveOpsSnapshot(
  admin: SupabaseClient,
  locationId: string
): Promise<LiveOpsSnapshot> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const delayThreshold = new Date(Date.now() - 15 * 60_000).toISOString();

  const [
    { count: activeTables },
    { count: preparingOrders },
    { count: delayedOrders },
    { count: todayOrderCount },
    { count: todaySessionCount },
  ] = await Promise.all([
    admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("status", "active"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("status", "preparing"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("status", "preparing")
      .lte("created_at", delayThreshold),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .gte("created_at", start.toISOString()),
    admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .gte("opened_at", start.toISOString()),
  ]);

  return {
    activeTables: activeTables ?? 0,
    preparingOrders: preparingOrders ?? 0,
    delayedOrders: delayedOrders ?? 0,
    todayOrderCount: todayOrderCount ?? 0,
    todaySessionCount: todaySessionCount ?? 0,
  };
}

type Props = {
  snapshot: LiveOpsSnapshot;
};

export function DenisLiveOpsWidget({ snapshot }: Props) {
  const conversion =
    snapshot.todaySessionCount > 0
      ? Math.round(
          (snapshot.todayOrderCount / snapshot.todaySessionCount) * 100
        )
      : 0;

  return (
    <QrCard>
      <QrCardTitle>Live ops</QrCardTitle>
      <QrCardDescription>Real-time pregled stolova i kuhinje.</QrCardDescription>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Aktivni stolovi" value={snapshot.activeTables} />
        <Metric label="U pripremi" value={snapshot.preparingOrders} />
        <Metric label="Kasni (>15 min)" value={snapshot.delayedOrders} warn />
        <Metric label="Narudžbine danas" value={snapshot.todayOrderCount} />
        <Metric label="Sesije danas" value={snapshot.todaySessionCount} />
        <Metric label="Konverzija" value={`${conversion}%`} />
      </div>
    </QrCard>
  );
}

function Metric({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          warn && Number(value) > 0 ? "text-amber-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
