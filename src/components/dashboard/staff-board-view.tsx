"use client";

import { useState, useTransition } from "react";
import { Copy, Shield, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  StaffPermissionsEditor,
  StaffPermissionsGrid,
} from "@/components/admin/staff-permissions-grid";
import { DenisStaffTrainingPanel } from "@/components/admin/denis-staff-training-panel";
import { StaffLocationsEditor } from "@/components/dashboard/staff-locations-editor";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  createStaffInvite,
  revokeStaffInvite,
  setStaffActive,
} from "@/lib/dashboard/staff-actions";
import { setStaffPermissionOverrides } from "@/lib/dashboard/staff-permission-actions";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { PermissionOverride } from "@/lib/auth/staff-access";
import { STAFF_ROLES } from "@/lib/constants";
import type { StaffTrainingSnapshot } from "@/lib/admin/load-staff-training-insight";
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

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  kitchen: "Kitchen",
  waiter: "Waiter",
  bar: "Bar",
};

const inputClassName =
  "w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent";

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

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

function TeamTable({
  staff,
  currentStaffId,
  canManage,
  overridesByStaffId,
  actorGrantable,
  locationsByStaffId,
  allLocations,
  pending,
  onPermissionSave,
  onActiveChange,
}: {
  staff: StaffRow[];
  currentStaffId: string;
  canManage: boolean;
  overridesByStaffId: Record<string, PermissionOverride[]>;
  actorGrantable: Set<PermissionKey> | null;
  locationsByStaffId?: Record<string, string[]>;
  allLocations?: Array<{ id: string; name: string }>;
  pending: boolean;
  onPermissionSave: (staffId: string, overrides: PermissionOverride[]) => void;
  onActiveChange: (staffId: string, active: boolean) => void;
}) {
  const showLocations =
    canManage && allLocations && allLocations.length > 1;

  return (
    <QrCard variant="muted" padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-dash-border bg-dash-surface text-dash-text-disabled">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Email
              </th>
              <th className="px-4 py-3 font-medium">Role</th>
              {showLocations && (
                <th className="px-4 py-3 font-medium">Locations</th>
              )}
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
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full border border-dash-border bg-dash-bg px-2.5 py-0.5 text-xs font-medium text-dash-text-secondary">
                    {roleLabel(member.role)}
                  </span>
                </td>
                {showLocations && (
                  <td className="px-4 py-3">
                    <StaffLocationsEditor
                      staffId={member.id}
                      staffName={member.name}
                      currentLocationIds={
                        locationsByStaffId?.[member.id] ?? []
                      }
                      allLocations={allLocations}
                      disabled={member.id === currentStaffId}
                    />
                  </td>
                )}
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
                              onSave={async (overrides) =>
                                onPermissionSave(member.id, overrides)
                              }
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
                          onActiveChange(member.id, active)
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
    </QrCard>
  );
}

export function StaffBoardView({
  staff,
  invites,
  currentStaffId,
  canManage,
  overridesByStaffId,
  actorGrantable,
  trainingSnapshot,
  locationsByStaffId,
  allLocations,
}: {
  staff: StaffRow[];
  invites: InviteRow[];
  currentStaffId: string;
  canManage: boolean;
  overridesByStaffId: Record<string, PermissionOverride[]>;
  actorGrantable: Set<PermissionKey> | null;
  trainingSnapshot?: StaffTrainingSnapshot | null;
  locationsByStaffId?: Record<string, string[]>;
  allLocations?: Array<{ id: string; name: string }>;
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

  function handlePermissionSave(
    staffId: string,
    overrides: PermissionOverride[]
  ) {
    startTransition(async () => {
      const result = await setStaffPermissionOverrides(staffId, overrides);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Permissions updated");
    });
  }

  function handleActiveChange(staffId: string, active: boolean) {
    startTransition(async () => {
      const result = await setStaffActive(staffId, active);
      if (result.error) toast.error(result.error);
    });
  }

  const activeCount = staff.filter((member) => member.is_active).length;

  return (
    <Tabs defaultValue="team" className="space-y-6">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-dash-border bg-dash-surface/60 p-1 sm:w-auto">
        <TabsTrigger
          value="team"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-dash-accent data-[state=active]:text-white"
        >
          Team
        </TabsTrigger>
        {canManage && (
          <>
            <TabsTrigger value="invites" className="rounded-lg px-4 py-2">
              Invites
              {invites.length > 0 && (
                <span className="ml-2 rounded-full bg-dash-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-dash-accent">
                  {invites.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="training" className="rounded-lg px-4 py-2">
              Training
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="team" className="mt-0 space-y-4 focus-visible:outline-none">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">Team roster</h2>
            <p className="mt-1 text-sm text-dash-text-muted">
              {activeCount} active · {staff.length} total
              {!canManage && " · view only"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-dash-text-disabled">
            <Users className="size-4" />
            Roles control which app each person opens first
          </div>
        </div>

        <TeamTable
          staff={staff}
          currentStaffId={currentStaffId}
          canManage={canManage}
          overridesByStaffId={overridesByStaffId}
          actorGrantable={actorGrantable}
          locationsByStaffId={locationsByStaffId}
          allLocations={allLocations}
          pending={pending}
          onPermissionSave={handlePermissionSave}
          onActiveChange={handleActiveChange}
        />
      </TabsContent>

      {canManage && (
        <TabsContent value="invites" className="mt-0 space-y-6 focus-visible:outline-none">
          <QrCard variant="muted" padding="md">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-dash-accent-muted ring-1 ring-dash-accent/20">
                <UserPlus className="size-5 text-dash-accent" />
              </span>
              <div>
                <QrCardTitle className="text-base">Invite team member</QrCardTitle>
                <QrCardDescription>
                  Send a one-time link. They choose a password and land in the
                  app matching their role.
                </QrCardDescription>
              </div>
            </div>

            <form onSubmit={handleInvite} className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm text-dash-text-muted">Full name</span>
                <input name="name" required className={inputClassName} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm text-dash-text-muted">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  className={inputClassName}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm text-dash-text-muted">Role</span>
                <select
                  name="role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className={inputClassName}
                >
                  {STAFF_ROLES.filter((r) => r !== "owner").map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium text-dash-text-secondary">
                  Initial permissions
                </p>
                <p className="mb-3 text-xs text-dash-text-disabled">
                  Optional overrides on top of the role template. You can change
                  these later from the Team tab.
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
                  {pending ? "Creating…" : "Create invite link"}
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
          </QrCard>

          {invites.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-dash-text">
                Pending invites
              </h3>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-surface/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-dash-text">{invite.name}</p>
                      <p className="text-sm text-dash-text-disabled">
                        {invite.email} · {roleLabel(invite.role)} · expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      )}

      {canManage && (
        <TabsContent value="training" className="mt-0 focus-visible:outline-none">
          <DenisStaffTrainingPanel snapshot={trainingSnapshot ?? null} />
        </TabsContent>
      )}
    </Tabs>
  );
}
