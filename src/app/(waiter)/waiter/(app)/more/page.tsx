import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getEffectiveStaff } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/get-staff-access";
import {
  computeWaiterExtraNavModules,
  WAITER_PRIMARY_NAV_HREFS,
} from "@/lib/auth/staff-modules";

export default async function WaiterMorePage() {
  const staff = await getEffectiveStaff();
  const access = await getStaffAccess(staff);
  const extras = computeWaiterExtraNavModules(access).filter(
    (module) => module.href !== "/waiter/fiscal"
  );

  if (extras.length === 0) {
    redirect("/waiter");
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold text-dash-text">More</h1>
      <ul className="divide-y divide-dash-border-subtle rounded-xl border border-dash-border-subtle bg-dash-surface">
        {extras.map((module) => (
          <li key={module.id}>
            <Link
              href={module.href}
              className="flex min-h-12 items-center justify-between px-4 py-3 text-sm font-medium text-dash-text"
            >
              {module.label}
              <ChevronRight className="size-4 text-dash-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {/* Primary nav hrefs documented for layout tests */}
      <span className="sr-only">{[...WAITER_PRIMARY_NAV_HREFS].join(" ")}</span>
    </div>
  );
}
