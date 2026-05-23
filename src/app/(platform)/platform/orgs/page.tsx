import { Suspense } from "react";
import { OrgListTable } from "@/components/platform/org-list-table";
import { loadPlatformOrgs, type OrgTrialStatus } from "@/lib/platform/platform-stats";
import { Skeleton } from "@/components/ui/skeleton";

async function OrgListContent({
  filter,
  search,
}: {
  filter?: OrgTrialStatus;
  search?: string;
}) {
  const orgs = await loadPlatformOrgs(filter, search);
  return <OrgListTable orgs={orgs} />;
}

export default async function PlatformOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filterRaw = params.filter;
  const filter =
    filterRaw === "active" ||
    filterRaw === "trial" ||
    filterRaw === "expired" ||
    filterRaw === "setup"
      ? filterRaw
      : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Organizations</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Search and filter venues on the platform.
        </p>
      </div>

      <Suspense
        fallback={<Skeleton className="h-96 w-full rounded-lg" />}
        key={`${filter ?? "all"}-${params.q ?? ""}`}
      >
        <OrgListContent filter={filter} search={params.q} />
      </Suspense>
    </div>
  );
}
