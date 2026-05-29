"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { StaffSurface } from "@/lib/auth/role-templates";
import type { StaffModule } from "@/lib/auth/staff-modules";
import {
  can,
  type AccessContext,
  type StaffAccess,
} from "@/lib/auth/staff-access";

export type ClientStaffAccess = {
  permissions: PermissionKey[];
  primarySurface: StaffSurface;
  allowedSurfaces: StaffSurface[];
  modules: StaffModule[];
};

const StaffAccessContext = createContext<ClientStaffAccess | null>(null);

function toClientAccess(access: StaffAccess): ClientStaffAccess {
  return {
    permissions: [...access.permissions],
    primarySurface: access.primarySurface,
    allowedSurfaces: access.allowedSurfaces,
    modules: access.modules,
  };
}

export function StaffAccessProvider({
  access,
  children,
}: {
  access: StaffAccess;
  children: ReactNode;
}) {
  const value = useMemo(() => toClientAccess(access), [access]);

  return (
    <StaffAccessContext.Provider value={value}>
      {children}
    </StaffAccessContext.Provider>
  );
}

export function useStaffAccess(): ClientStaffAccess {
  const context = useContext(StaffAccessContext);
  if (!context) {
    throw new Error("useStaffAccess must be used within StaffAccessProvider");
  }
  return context;
}

export function useCan(permission: PermissionKey, ctx?: AccessContext): boolean {
  const clientAccess = useStaffAccess();

  const access = useMemo(
    (): StaffAccess => ({
      permissions: new Set(clientAccess.permissions),
      primarySurface: clientAccess.primarySurface,
      allowedSurfaces: clientAccess.allowedSurfaces,
      modules: clientAccess.modules,
    }),
    [clientAccess]
  );

  const check = useCallback(
    () => can(access, permission, ctx),
    [access, permission, ctx]
  );

  return check();
}
