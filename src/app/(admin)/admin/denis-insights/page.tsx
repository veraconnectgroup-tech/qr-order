import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadLearnedEdgeQueue } from "@/lib/admin/denis-learned-edges";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { DenisLearnedEdgesManager } from "@/components/admin/denis-learned-edges-manager";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DenisInsightsAdminPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const [edges, config] = await Promise.all([
    loadLearnedEdgeQueue(admin, locationId, "pending"),
    loadConciergeConfigForLocation(locationId),
  ]);

  const productIds = [
    ...new Set(
      edges.flatMap((edge) => [edge.from_product_id, edge.to_product_id])
    ),
  ];

  const productNames: Record<string, string> = {};
  if (productIds.length) {
    const { data: products } = await admin
      .from("products")
      .select("id, name")
      .in("id", productIds);

    for (const product of (products ?? []) as Array<{ id: string; name: string }>) {
      productNames[product.id] = product.name;
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <DenisLearnedEdgesManager
        edges={edges}
        productNames={productNames}
        learnedEnabled={config.learning.learnedEdgesEnabled}
      />
    </div>
  );
}
