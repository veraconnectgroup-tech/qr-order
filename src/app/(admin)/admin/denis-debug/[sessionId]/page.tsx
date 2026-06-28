import { notFound } from "next/navigation";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadDenisSessionReplay } from "@/lib/admin/denis-debug";
import { DenisDebugReplayView } from "@/components/admin/denis-debug-replay-view";
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
      <p className="text-sm text-muted-foreground">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const replay = await loadDenisSessionReplay(admin, {
    sessionId,
    locationId,
  });

  if (!replay) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <DenisDebugReplayView sessionId={sessionId} replay={replay} />
    </div>
  );
}
