"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { getStaffAccess } from "@/lib/auth/get-staff-access";
import {
  parsePermissionOverridesJson,
  computeOverridesForStorage,
} from "@/lib/auth/permission-overrides";
import {
  ALL_PERMISSIONS,
  type PermissionKey,
} from "@/lib/auth/permission-catalog";
import type { PermissionOverride } from "@/lib/auth/staff-access";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ROLE_TEMPLATES,
  type StaffTemplateRole,
} from "@/lib/auth/role-templates";

const permissionKeySchema = z.enum(
  ALL_PERMISSIONS as [PermissionKey, ...PermissionKey[]]
);

const overrideSchema = z.object({
  permission: permissionKeySchema,
  granted: z.boolean(),
});

const overridesSchema = z.array(overrideSchema);

function isTemplateRole(role: string): role is StaffTemplateRole {
  return role in ROLE_TEMPLATES;
}

async function requireStaffManageActor() {
  const actor = await requireStaff();
  const access = await getStaffAccess(actor);

  if (!access.permissions.has("staff.manage")) {
    return { error: "Unauthorized." as const, actor: null, access: null };
  }

  return { error: null, actor, access };
}

async function loadTargetStaff(staffId: string, orgId: string) {
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("staff")
    .select("id, org_id, role")
    .eq("id", staffId)
    .is("deleted_at", null)
    .maybeSingle();

  const row = target as { id: string; org_id: string; role: string } | null;
  if (!row || row.org_id !== orgId) {
    return null;
  }
  return row;
}

function validateSa7(
  actorRole: string,
  actorPermissions: Set<PermissionKey>,
  overrides: PermissionOverride[]
): string | null {
  if (actorRole === "owner") {
    return null;
  }

  for (const override of overrides) {
    if (override.granted && !actorPermissions.has(override.permission)) {
      return `You cannot grant permission: ${override.permission}`;
    }
  }

  return null;
}

export async function setStaffPermissionOverrides(
  staffId: string,
  overrides: PermissionOverride[]
) {
  const gate = await requireStaffManageActor();
  if (gate.error || !gate.actor || !gate.access) {
    return { error: gate.error ?? "Unauthorized." };
  }

  const parsed = overridesSchema.safeParse(overrides);
  if (!parsed.success) {
    return { error: "Invalid permission overrides." };
  }

  const target = await loadTargetStaff(staffId, gate.actor.org_id);
  if (!target) {
    return { error: "Staff member not found." };
  }

  if (target.role === "owner") {
    return { error: "Owner permissions cannot be modified." };
  }

  if (gate.actor.role === "manager" && target.role === "owner") {
    return { error: "Managers cannot modify owner accounts." };
  }

  const sa7Error = validateSa7(
    gate.actor.role,
    gate.access.permissions,
    parsed.data
  );
  if (sa7Error) {
    return { error: sa7Error };
  }

  const admin = createAdminClient();

  const { error: deleteError } = await admin
    .from("staff_permission_overrides")
    .delete()
    .eq("staff_id", staffId);

  if (deleteError) {
    return { error: "Could not update permissions." };
  }

  if (parsed.data.length > 0) {
    const { error: insertError } = await admin
      .from("staff_permission_overrides")
      .insert(
        parsed.data.map((override) => ({
          staff_id: staffId,
          permission: override.permission,
          granted: override.granted,
          granted_by: gate.actor!.id,
        }))
      );

    if (insertError) {
      return { error: "Could not save permissions." };
    }
  }

  await auditLog({
    orgId: gate.actor.org_id,
    userId: gate.actor.user_id,
    action: "update",
    entityType: "staff_permission_overrides",
    entityId: staffId,
    newValue: { overrides: parsed.data },
  });

  revalidatePath("/dashboard/staff");
  return { data: { ok: true } };
}

/** Save effective permission set (UI checkbox state → diff vs template). */
export async function setStaffEffectivePermissions(
  staffId: string,
  role: string,
  effectivePermissions: PermissionKey[]
) {
  if (!isTemplateRole(role)) {
    return { error: "Invalid staff role." };
  }

  const effective = new Set(effectivePermissions);
  const overrides = computeOverridesForStorage(role, effective);
  return setStaffPermissionOverrides(staffId, overrides);
}

export async function applyInvitePermissionOverrides(
  staffId: string,
  inviteOverrides: unknown,
  grantedBy: string
) {
  const overrides = parsePermissionOverridesJson(inviteOverrides);
  if (overrides.length === 0) {
    return;
  }

  const admin = createAdminClient();
  await admin.from("staff_permission_overrides").insert(
    overrides.map((override) => ({
      staff_id: staffId,
      permission: override.permission,
      granted: override.granted,
      granted_by: grantedBy,
    }))
  );
}
