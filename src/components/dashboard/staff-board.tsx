"use client";

import { useState, useTransition } from "react";
import { Copy, Shield, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  StaffPermissionsEditor,
  StaffPermissionsGrid,
  parseOverridesFormField,
} from "@/components/admin/staff-permissions-grid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createStaffInvite,
  revokeStaffInvite,
  setStaffActive,
} from "@/lib/dashboard/staff-actions";
import { setStaffPermissionOverrides } from "@/lib/dashboard/staff-permission-actions";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { PermissionOverride } from "@/lib/auth/staff-access";
import { STAFF_ROLES } from "@/lib/constants";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  is_active: boolean;
};

type InviteRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  expires_at: string;
  link: string;
};

function InvitePermissionsSection({
  role,
  actorGrantable,
}: {
  role: string;
  actorGrantable: Set<PermissionKey> | null;
}) {
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);

  return (
    <>
      <input
        type="hidden"
        name="permission_overrides"
        value={JSON.stringify(overrides)}
      />
      <StaffPermissionsGrid
        role={role}
        overrides={overrides}
        onChange={setOverrides}
        actorGrantable={actorGrantable}
      />
    </>
  );
}

export function StaffBoard({
  staff,
  invites,
  currentStaffId,
  canManage,
  overridesByStaffId,
  actorGrantable,
}: {
  staff: StaffRow[];
  invites: InviteRow[];
  currentStaffId: string;
  canManage: boolean;
  overridesByStaffId: Record<string, PermissionOverride[]>;
  /** null = owner (all grantable). */
  actorGrantable: Set<PermissionKey> | null;
}) {
  const [pending, startTransition] = useTransition();
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("staff");

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      const result = await createStaffInvite(fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data?.link) {
        setLastLink(result.data.link);
        toast.success("Invite created");
      }
      form.reset();
      setInviteRole("staff");
    });
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  }

  return (
    <div className="space-y-8">
      {canManage && (
        <section className="rounded-xl border border-dash-border bg-dash-surface p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="size-5 text-dash-accent" />
            <h2 className="text-lg font-semibold text-dash-text">Invite staff</h2>
          </div>

          <form onSubmit={handleInvite} className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm text-dash-text-muted">Full name</span>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-dash-text-muted">Email</span>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-dash-text-muted">Role</span>
              <select
                name="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              >
                {STAFF_ROLES.filter((r) => r !== "owner").map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-dash-text-secondary">
                Initial permissions
              </p>
              <InvitePermissionsSection
                key={inviteRole}
                role={inviteRole}
                actorGrantable={actorGrantable}
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>

          {lastLink && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg p-3">
              <code className="min-w-0 flex-1 truncate text-xs text-dash-text-muted">
                {lastLink}
              </code>
              <button
                type="button"
                onClick={() => copyLink(lastLink)}
                className="shrink-0 rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-raised hover:text-dash-text-secondary"
                aria-label="Copy invite link"
              >
                <Copy className="size-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {invites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-dash-text-disabled">
            Pending invites
          </h2>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-surface/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-dash-text">{invite.name}</p>
                  <p className="text-sm text-dash-text-disabled">
                    {invite.email} · {invite.role}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(invite.link)}
                      className="rounded-lg border border-dash-surface-overlay px-3 py-1.5 text-xs text-dash-text-secondary hover:bg-dash-surface-raised"
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await revokeStaffInvite(invite.id);
                          if (result.error) toast.error(result.error);
                          else toast.success("Invite revoked");
                        })
                      }
                      className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-dash-text-disabled" />
          <h2 className="text-sm font-medium uppercase tracking-wide text-dash-text-disabled">
            Team ({staff.length})
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-dash-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-dash-border bg-dash-surface text-dash-text-disabled">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  {canManage && (
                    <>
                      <th className="px-4 py-3 font-medium">Permissions</th>
                      <th className="px-4 py-3 font-medium">Active</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className={cn(
                      "border-b border-dash-border/80 last:border-0",
                      !member.is_active && "opacity-50"
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-dash-text">
                      {member.name}
                      {member.id === currentStaffId && (
                        <span className="ml-2 text-xs text-dash-text-disabled">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-dash-text-muted sm:table-cell">
                      {member.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-dash-text-muted">
                      {member.role}
                    </td>
                    {canManage && (
                      <>
                        <td className="px-4 py-3">
                          {member.role === "owner" ? (
                            <span className="text-xs text-dash-text-disabled">
                              All permissions
                            </span>
                          ) : (
                            <Dialog>
                              <DialogTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-dash-surface-overlay px-2.5 py-1.5 text-xs text-dash-text-secondary hover:bg-dash-surface-raised"
                                >
                                  <Shield className="size-3.5" />
                                  Edit
                                </button>
                              </DialogTrigger>
                              <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-border bg-dash-surface sm:max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="text-dash-text">
                                    Permissions — {member.name}
                                  </DialogTitle>
                                </DialogHeader>
                                <StaffPermissionsEditor
                                  key={JSON.stringify(
                                    overridesByStaffId[member.id] ?? []
                                  )}
                                  role={member.role}
                                  initialOverrides={
                                    overridesByStaffId[member.id] ?? []
                                  }
                                  actorGrantable={actorGrantable}
                                  saving={pending}
                                  onSave={async (overrides) => {
                                    startTransition(async () => {
                                      const result =
                                        await setStaffPermissionOverrides(
                                          member.id,
                                          overrides
                                        );
                                      if (result.error) {
                                        toast.error(result.error);
                                        return;
                                      }
                                      toast.success("Permissions updated");
                                    });
                                  }}
                                />
                              </DialogContent>
                            </Dialog>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={member.is_active}
                            disabled={
                              member.id === currentStaffId ||
                              member.role === "owner"
                            }
                            onCheckedChange={(active) =>
                              startTransition(async () => {
                                const result = await setStaffActive(
                                  member.id,
                                  active
                                );
                                if (result.error) toast.error(result.error);
                              })
                            }
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
