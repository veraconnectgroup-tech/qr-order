import { format, subDays } from "date-fns";
import { loadVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg";
import {
  analyzeMenu,
  type MenuEngineeringInsight,
} from "@/lib/denis/platform/menu-engineering";
import { loadMenuEngineeringOrderRows } from "@/lib/denis/platform/load-menu-engineering-rows";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MenuEngineeringSnapshot = MenuEngineeringInsight & {
  locationId: string;
  locationName: string;
  periodDays: number;
  fromDate: string;
  toDate: string;
  totalOrderLines: number;
};

export async function loadMenuEngineeringSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    periodDays?: number;
  }
): Promise<MenuEngineeringSnapshot | null> {
  const periodDays = input.periodDays ?? 30;
  const toDate = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");

  const { data: locationRow } = await admin
    .from("locations")
    .select("id, name")
    .eq("id", input.locationId)
    .maybeSingle();

  if (!locationRow) return null;

  try {
    const [graph, orderHistory] = await Promise.all([
      loadVenueKnowledgeGraph(input.locationId),
      loadMenuEngineeringOrderRows(admin, {
        locationId: input.locationId,
        lookbackDays: periodDays,
      }),
    ]);

    const products = Object.values(graph.products).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      isAvailable: product.isAvailable,
    }));
    const insight = analyzeMenu({
      products,
      orderHistory,
      lookbackDays: periodDays,
    });

    return {
      locationId: input.locationId,
      locationName: (locationRow as { name: string }).name,
      periodDays,
      fromDate,
      toDate,
      totalOrderLines: orderHistory.length,
      ...insight,
    };
  } catch (error) {
    logger.warn("loadMenuEngineeringSnapshot failed", {
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
