import { DatevExportPanel } from "@/components/admin/datev-export-panel";

export default function AdminAnalyticsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Export für Buchhaltung und monatlichen DATEV-Import.
        </p>
      </div>

      <div className="max-w-2xl">
        <DatevExportPanel />
      </div>
    </div>
  );
}
