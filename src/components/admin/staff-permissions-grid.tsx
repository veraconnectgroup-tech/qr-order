"use client";

import { useMemo, useState } from "react";
import {
  ADMIN_PERMISSIONS,
  FISCAL_PERMISSIONS,
  OPERATIONS_PERMISSIONS,
  PERMISSION_CATALOG,
  type PermissionKey,
} from "@/lib/auth/permission-catalog";
import {
  PRIMARY_SURFACE,
  ROLE_TEMPLATES,
  type StaffTemplateRole,
} from "@/lib/auth/role-templates";
import {
  resolveStaffAccess,
  type PermissionOverride,
} from "@/lib/auth/staff-access";
import { computeModulesForSurface } from "@/lib/auth/staff-modules";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const PAYMENTS_PERMISSIONS: PermissionKey[] = [
  "payments.collect",
  "payments.refund",
];

const OPERATIONS_GROUP = OPERATIONS_PERMISSIONS.filter(
  (key) => !PAYMENTS_PERMISSIONS.includes(key)
);

const PERMISSION_GROUPS: Array<{
  id: string;
  label: string;
  permissions: readonly PermissionKey[];
}> = [
  { id: "operations", label: "Operations", permissions: OPERATIONS_GROUP },
  { id: "payments", label: "Payments", permissions: PAYMENTS_PERMISSIONS },
  { id: "fiscal", label: "Fiscal", permissions: FISCAL_PERMISSIONS },
  { id: "admin", label: "Admin", permissions: ADMIN_PERMISSIONS },
];

function isTemplateRole(role: string): role is StaffTemplateRole {
  return role in ROLE_TEMPLATES;
}

function surfaceLabel(role: StaffTemplateRole): string {
  const surface = PRIMARY_SURFACE[role];
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

function buildAccessPreview(role: string, overrides: PermissionOverride[]) {
  const templateRole = isTemplateRole(role) ? role : "staff";
  const access = resolveStaffAccess({ id: "preview", role: templateRole }, overrides);
  const defaultAccess = resolveStaffAccess({ id: "preview", role: templateRole });

  const defaultModuleIds = new Set(
    computeModulesForSurface(defaultAccess, defaultAccess.primarySurface).map(
      (module) => module.id
    )
  );

  const extraModules = computeModulesForSurface(
    access,
    access.primarySurface
  )
    .filter((module) => !defaultModuleIds.has(module.id))
    .map((module) => module.label);

  return {
    loginSurface: surfaceLabel(templateRole),
    extraModules,
  };
}

export function StaffPermissionsGrid({
  role,
  overrides,
  onChange,
  disabled = false,
  actorGrantable,
}: {
  role: string;
  overrides: PermissionOverride[];
  onChange: (overrides: PermissionOverride[]) => void;
  disabled?: boolean;
  /** SA-7: permissions the actor may grant (null = owner, all grantable). */
  actorGrantable?: Set<PermissionKey> | null;
}) {
  const templateRole = isTemplateRole(role) ? role : "staff";
  const template = useMemo(
    () => new Set(ROLE_TEMPLATES[templateRole]),
    [templateRole]
  );

  const access = useMemo(
    () =>
      resolveStaffAccess({ id: "grid", role: templateRole }, overrides),
    [templateRole, overrides]
  );

  const preview = useMemo(
    () => buildAccessPreview(role, overrides),
    [role, overrides]
  );

  function isChecked(permission: PermissionKey): boolean {
    return access.permissions.has(permission);
  }

  function isOverride(permission: PermissionKey): boolean {
    const inTemplate = template.has(permission);
    const inEffective = access.permissions.has(permission);
    return inTemplate !== inEffective;
  }

  function canToggleGrant(permission: PermissionKey, nextChecked: boolean): boolean {
    if (disabled) {
      return false;
    }
    if (!nextChecked) {
      return true;
    }
    if (actorGrantable === null || actorGrantable === undefined) {
      return true;
    }
    return actorGrantable.has(permission) || template.has(permission);
  }

  function togglePermission(permission: PermissionKey, checked: boolean) {
    if (!canToggleGrant(permission, checked)) {
      return;
    }

    const nextEffective = new Set(access.permissions);
    if (checked) {
      nextEffective.add(permission);
    } else {
      nextEffective.delete(permission);
    }

    const nextOverrides: PermissionOverride[] = [];
    for (const key of Object.keys(PERMISSION_CATALOG) as PermissionKey[]) {
      const inTemplate = template.has(key);
      const inEffective = nextEffective.has(key);
      if (inTemplate !== inEffective) {
        nextOverrides.push({ permission: key, granted: inEffective });
      }
    }

    onChange(nextOverrides);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dash-border bg-dash-bg/60 px-3 py-2 text-sm text-dash-text-muted">
        <span className="text-dash-text-secondary">Logs into:</span>{" "}
        <span className="font-medium text-dash-text">{preview.loginSurface}</span>
        {preview.extraModules.length > 0 && (
          <>
            {" "}
            · <span className="text-dash-text-secondary">Extra:</span>{" "}
            <span className="font-medium text-dash-accent">
              {preview.extraModules.join(", ")}
            </span>
          </>
        )}
      </div>

      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.id} className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-dash-text-disabled">
            {group.label}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.permissions.map((permission) => {
              const meta = PERMISSION_CATALOG[permission];
              const checked = isChecked(permission);
              const diff = isOverride(permission);
              const grantBlocked =
                !checked &&
                actorGrantable != null &&
                !actorGrantable.has(permission) &&
                !template.has(permission);

              return (
                <label
                  key={permission}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors",
                    diff
                      ? "border-dash-accent/40 bg-dash-accent/5"
                      : "border-dash-border bg-dash-surface/40",
                    (disabled || grantBlocked) && "cursor-not-allowed opacity-60"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled || grantBlocked}
                    onCheckedChange={(value) =>
                      togglePermission(permission, value === true)
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-dash-text">
                      {meta.label}
                      {diff && (
                        <span className="ml-1.5 text-xs font-normal text-dash-accent">
                          override
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-dash-text-disabled">
                      {meta.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function parseOverridesFormField(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [] as PermissionOverride[];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is PermissionOverride =>
        item &&
        typeof item === "object" &&
        "permission" in item &&
        "granted" in item &&
        typeof item.permission === "string" &&
        typeof item.granted === "boolean"
    );
  } catch {
    return [];
  }
}

/** Controlled wrapper with local draft state for forms. */
export function StaffPermissionsEditor({
  role,
  initialOverrides,
  onSave,
  saving,
  actorGrantable,
}: {
  role: string;
  initialOverrides: PermissionOverride[];
  onSave: (overrides: PermissionOverride[]) => Promise<void>;
  saving?: boolean;
  actorGrantable?: Set<PermissionKey> | null;
}) {
  const [draft, setDraft] = useState(initialOverrides);

  return (
    <div className="space-y-4">
      <StaffPermissionsGrid
        role={role}
        overrides={draft}
        onChange={setDraft}
        disabled={saving}
        actorGrantable={actorGrantable}
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => onSave(draft)}
        className="rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save permissions"}
      </button>
    </div>
  );
}
