import { Activity } from "lucide-react";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  listDenisDebugSessions,
} from "@/lib/admin/denis-debug";
import { DenisDebugSessionList } from "@/components/admin/denis-debug-session-list";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DenisDebugAdminPage() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return (
      <p className="text-sm text-neutral-500">No location assigned.</p>
    );
  }

  const admin = createAdminClient();
  const sessions = await listDenisDebugSessions(admin, locationId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start gap-3">
        <Activity className="mt-0.5 size-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold">Denis Debugger</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Replay beliefs, goals, and append-only timeline per guest AI session
            — staff-only (ADR-004 K10 / M19).
          </p>
        </div>
      </div>

      <DenisDebugSessionList sessions={sessions} />
    </div>
  );
}
