import {
  CHURN_RISK_DAYS,
  daysSinceLastVisit,
  isChurnRiskGuest,
} from "@/lib/denis/retention/guest-engagement-loop";
import { buildRetentionInsight } from "@/lib/denis/retention/retention-intelligence";
import type { SupabaseClient } from "@supabase/supabase-js";

type EngagementEventRow = {
  trigger: string;
  returned_at: string | null;
  ordered_item: boolean | null;
};

type GuestMemoryRow = {
  visit_count: number;
  last_visit_at: string | null;
};

export async function loadRetentionInsight(
  admin: SupabaseClient,
  input: {
    locationId: string;
    fromIso: string;
    toIso: string;
  }
) {
  const [{ data: events }, { data: guests }] = await Promise.all([
    admin
      .from("denis_guest_engagement_events" as never)
      .select("trigger, returned_at, ordered_item")
      .eq("location_id", input.locationId)
      .gte("sent_at", input.fromIso)
      .lte("sent_at", input.toIso),
    admin
      .from("denis_guest_memory" as never)
      .select("visit_count, last_visit_at")
      .eq("location_id", input.locationId)
      .gte("visit_count", 3),
  ]);

  const rows = (events ?? []) as EngagementEventRow[];
  const winBackRows = rows.filter((row) => row.trigger === "win_back");
  const weeklyRows = rows.filter((row) => row.trigger === "weekly_special");

  const churnRiskVipCount = ((guests ?? []) as GuestMemoryRow[]).filter(
    (guest) =>
      isChurnRiskGuest({
        visitCount: guest.visit_count,
        daysSinceLastVisit: daysSinceLastVisit(guest.last_visit_at),
      })
  ).length;

  return buildRetentionInsight({
    winBackSent: winBackRows.length,
    winBackReturned: winBackRows.filter((row) => row.returned_at).length,
    weeklySpecialSent: weeklyRows.length,
    weeklySpecialOrdered: weeklyRows.filter((row) => row.ordered_item).length,
    churnRiskVipCount,
  });
}

export { CHURN_RISK_DAYS };
