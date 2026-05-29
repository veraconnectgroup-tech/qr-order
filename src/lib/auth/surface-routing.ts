import type { StaffSurface } from "@/lib/auth/role-templates";

const PATH_SURFACE_PREFIXES: ReadonlyArray<{
  prefix: string;
  surface: StaffSurface;
}> = [
  { prefix: "/waiter", surface: "waiter" },
  { prefix: "/bar", surface: "bar" },
  { prefix: "/kitchen", surface: "kitchen" },
  { prefix: "/dashboard", surface: "dashboard" },
  { prefix: "/admin", surface: "admin" },
  { prefix: "/fiscal", surface: "fiscal" },
];

/** Maps a pathname to a staff app surface, if any. */
export function pathnameToSurface(pathname: string): StaffSurface | null {
  for (const { prefix, surface } of PATH_SURFACE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return surface;
    }
  }
  return null;
}

export function isStaffAppPath(pathname: string): boolean {
  return pathnameToSurface(pathname) !== null;
}

export const STAFF_AUTH_PATH_PREFIXES = [
  "/dashboard",
  "/waiter",
  "/bar",
  "/kitchen",
  "/admin",
  "/platform",
  "/fiscal",
] as const;

export function pathNeedsStaffAuth(pathname: string): boolean {
  return (
    STAFF_AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === "/login" ||
    pathname === "/signup"
  );
}
