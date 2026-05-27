"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUDIT_ACTIONS } from "@/lib/audit/constants";

export function AuditLogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const action = String(fd.get("action") ?? "").trim();
    const dateFrom = String(fd.get("dateFrom") ?? "").trim();
    const dateTo = String(fd.get("dateTo") ?? "").trim();

    if (action) params.set("action", action);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("page", "1");

    router.push(`/admin/audit-log?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div>
        <Label htmlFor="audit-action" className="text-xs text-muted-foreground">
          Action
        </Label>
        <select
          id="audit-action"
          name="action"
          defaultValue={searchParams.get("action") ?? ""}
          className="mt-1 block h-9 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="audit-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="audit-from"
          name="dateFrom"
          type="date"
          defaultValue={searchParams.get("from") ?? ""}
          className="mt-1 w-40"
        />
      </div>
      <div>
        <Label htmlFor="audit-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="audit-to"
          name="dateTo"
          type="date"
          defaultValue={searchParams.get("to") ?? ""}
          className="mt-1 w-40"
        />
      </div>
      <Button type="submit" size="sm">
        Filter
      </Button>
    </form>
  );
}
