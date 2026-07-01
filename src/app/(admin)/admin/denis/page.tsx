import { requireAdmin } from "@/lib/auth/session";
import { loadDenisConfigEditorSnapshotAction } from "@/lib/admin/denis-config-editor-actions";
import { loadDenisPlaybookEditorSnapshotAction } from "@/lib/admin/denis-playbook-actions";
import { DenisConfigEditor } from "@/components/admin/denis-config-editor";

export default async function AdminDenisConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const [snapshot, playbookSnapshot] = await Promise.all([
    loadDenisConfigEditorSnapshotAction(params.locationId),
    loadDenisPlaybookEditorSnapshotAction(params.locationId),
  ]);

  if ("error" in snapshot) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{snapshot.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <DenisConfigEditor
        initialSnapshot={snapshot}
        playbookSnapshot={"error" in playbookSnapshot ? null : playbookSnapshot}
      />
    </div>
  );
}
