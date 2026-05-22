"use client";

import { useState, useTransition } from "react";
import { Copy, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createStaffInvite,
  revokeStaffInvite,
  setStaffActive,
} from "@/lib/dashboard/staff-actions";
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

export function StaffBoard({
  staff,
  invites,
  currentStaffId,
  canManage,
}: {
  staff: StaffRow[];
  invites: InviteRow[];
  currentStaffId: string;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [lastLink, setLastLink] = useState<string | null>(null);

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
    });
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  }

  return (
    <div className="space-y-8">
      {canManage && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="size-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-zinc-50">Invite staff</h2>
          </div>

          <form onSubmit={handleInvite} className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm text-zinc-400">Full name</span>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Email</span>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-400">Role</span>
              <select
                name="role"
                defaultValue="staff"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500"
              >
                {STAFF_ROLES.filter((r) => r !== "owner").map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>

          {lastLink && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <code className="min-w-0 flex-1 truncate text-xs text-zinc-400">
                {lastLink}
              </code>
              <button
                type="button"
                onClick={() => copyLink(lastLink)}
                className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
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
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Pending invites
          </h2>
          <div className="space-y-2">
            {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{invite.name}</p>
                    <p className="text-sm text-zinc-500">
                      {invite.email} · {invite.role}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(invite.link)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
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
          <Users className="size-4 text-zinc-500" />
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Team ({staff.length})
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                {canManage && <th className="px-4 py-3 font-medium">Active</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr
                  key={member.id}
                  className={cn(
                    "border-b border-zinc-800/80 last:border-0",
                    !member.is_active && "opacity-50"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {member.name}
                    {member.id === currentStaffId && (
                      <span className="ml-2 text-xs text-zinc-500">(you)</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-400 sm:table-cell">
                    {member.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-400">
                    {member.role}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <Switch
                        checked={member.is_active}
                        disabled={
                          member.id === currentStaffId || member.role === "owner"
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
