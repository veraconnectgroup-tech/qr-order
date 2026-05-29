"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/security/escape";
import {
  zEmailNormalized,
  zInviteToken,
  zSanitizedText,
} from "@/lib/security/zod-fields";
import { auditLog } from "@/lib/audit/log";
import { parsePermissionOverridesJson } from "@/lib/auth/permission-overrides";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAFF_ROLES } from "@/lib/constants";
import { applyInvitePermissionOverrides } from "@/lib/dashboard/staff-permission-actions";

const inviteSchema = z.object({
  email: zEmailNormalized(),
  name: zSanitizedText(100).pipe(z.string().min(2)),
  role: z.enum(STAFF_ROLES),
});

export async function createStaffInvite(formData: FormData) {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Only owners and managers can invite staff." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: "Invalid invite details." };
  }

  const admin = createAdminClient();
  const { email, name, role } = parsed.data;
  const permissionOverrides = parsePermissionOverridesJson(
    formData.get("permission_overrides")
  );

  const { data: existingStaff } = await admin
    .from("staff")
    .select("id")
    .eq("org_id", staff.org_id)
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingStaff) {
    return { error: "This email is already on your team." };
  }

  const { data: pendingInvite } = await admin
    .from("staff_invites")
    .select("id")
    .eq("org_id", staff.org_id)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (pendingInvite) {
    return { error: "An active invite already exists for this email." };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await admin
    .from("staff_invites")
    .insert({
      org_id: staff.org_id,
      location_id: staff.location_id,
      email: email.toLowerCase(),
      name,
      role,
      invited_by: staff.id,
      expires_at: expiresAt,
      permission_overrides: permissionOverrides,
    } as never)
    .select("token")
    .single();

  if (error || !invite) {
    return { error: "Invite could not be created." };
  }

  const token = (invite as { token: string }).token;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/invite/${token}`;

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", staff.org_id)
    .single();

  const orgName = (org as { name: string } | null)?.name ?? "your venue";

  await sendEmail({
    to: email,
    subject: `Join ${orgName} on QR Order`,
    html: `<p>You've been invited to join <strong>${escapeHtml(orgName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
<p><a href="${escapeHtml(link)}">Accept invite and set your password →</a></p>
<p>This link expires in 7 days.</p>`,
  });

  await auditLog({
    orgId: staff.org_id,
    userId: staff.user_id,
    action: "create",
    entityType: "staff_invite",
    entityId: token,
    newValue: { email, name, role, permission_overrides: permissionOverrides },
  });

  revalidatePath("/dashboard/staff");
  return { data: { link } };
}

export async function setStaffActive(staffId: string, active: boolean) {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Unauthorized." };
  }

  if (staffId === staff.id) {
    return { error: "You cannot deactivate your own account." };
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("staff")
    .select("id, org_id, role")
    .eq("id", staffId)
    .single();

  const targetRow = target as {
    id: string;
    org_id: string;
    role: string;
  } | null;

  if (!targetRow || targetRow.org_id !== staff.org_id) {
    return { error: "Staff member not found." };
  }

  if (staff.role === "manager" && targetRow.role === "owner") {
    return { error: "Managers cannot change owner accounts." };
  }

  const { error } = await admin
    .from("staff")
    .update({ is_active: active })
    .eq("id", staffId);

  if (error) {
    return { error: "Could not update staff member." };
  }

  await auditLog({
    orgId: staff.org_id,
    userId: staff.user_id,
    action: "update",
    entityType: "staff",
    entityId: staffId,
    oldValue: { is_active: !active, role: targetRow.role },
    newValue: { is_active: active },
  });

  revalidatePath("/dashboard/staff");
  return { data: { ok: true } };
}

export async function revokeStaffInvite(inviteId: string) {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("staff_invites")
    .delete()
    .eq("id", inviteId)
    .eq("org_id", staff.org_id)
    .is("accepted_at", null);

  if (error) {
    return { error: "Could not revoke invite." };
  }

  revalidatePath("/dashboard/staff");
  return { data: { ok: true } };
}

const acceptSchema = z.object({
  token: zInviteToken(),
  password: z.string().trim().min(8).max(128),
});

export async function acceptStaffInvite(formData: FormData) {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Password must be at least 8 characters." };
  }

  const admin = createAdminClient();
  const { token, password } = parsed.data;

  const { data: invite } = await admin
    .from("staff_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!invite) {
    return { error: "Invite is invalid or has expired." };
  }

  const row = invite as {
    id: string;
    org_id: string;
    location_id: string | null;
    email: string;
    name: string;
    role: string;
    invited_by: string | null;
    permission_overrides: unknown;
  };

  const { data: existingStaff } = await admin
    .from("staff")
    .select("id")
    .eq("org_id", row.org_id)
    .eq("email", row.email)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingStaff) {
    return { error: "This email is already registered. Try signing in." };
  }

  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
      user_metadata: { name: row.name },
    });

  if (authError || !authUser.user) {
    if (authError?.message?.toLowerCase().includes("already")) {
      return { error: "An account with this email already exists. Sign in instead." };
    }
    return { error: authError?.message ?? "Account could not be created." };
  }

  const { error: staffError } = await admin.from("staff").insert({
    user_id: authUser.user.id,
    org_id: row.org_id,
    location_id: row.location_id,
    role: row.role as "owner" | "manager" | "staff" | "kitchen",
    name: row.name,
    email: row.email,
  });

  if (staffError) {
    return { error: "Staff profile could not be created." };
  }

  const { data: staffRow } = await admin
    .from("staff")
    .select("id")
    .eq("user_id", authUser.user.id)
    .eq("org_id", row.org_id)
    .single();

  if (staffRow) {
    const newStaffId = (staffRow as { id: string }).id;

    if (row.location_id) {
      await admin.from("staff_locations").insert({
        staff_id: newStaffId,
        location_id: row.location_id,
      } as never);
    }

    if (row.invited_by) {
      await applyInvitePermissionOverrides(
        newStaffId,
        row.permission_overrides,
        row.invited_by
      );
    }
  }

  await admin
    .from("staff_invites")
    .update({ accepted_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return { data: { ok: true } };
}

export async function getStaffInvite(token: string) {
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("staff_invites")
    .select("email, name, role, expires_at, accepted_at, org_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return null;

  const row = invite as {
    email: string;
    name: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
    org_id: string;
  };

  if (row.accepted_at || new Date(row.expires_at) < new Date()) {
    return null;
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", row.org_id)
    .single();

  return {
    email: row.email,
    name: row.name,
    role: row.role,
    orgName: (org as { name: string } | null)?.name ?? "Restaurant",
  };
}
