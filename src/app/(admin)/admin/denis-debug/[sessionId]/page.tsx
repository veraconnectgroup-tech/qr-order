import { notFound } from "next/navigation";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadDenisSessionDebugGraph } from "@/lib/admin/denis-debug";
import { DenisDebugGraphView } from "@/components/admin/denis-debug-graph-view";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DenisDebugSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  const { sessionId } = await params;

  if (!locationId) {
    return (
      <p className="text-sm text-neutral-500">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const graph = await loadDenisSessionDebugGraph(admin, {
    sessionId,
    locationId,
  });

  if (!graph) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <DenisDebugGraphView sessionId={sessionId} graph={graph} />
    </div>
  );
}
