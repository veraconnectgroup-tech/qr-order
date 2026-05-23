"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  getStaffAccessibleLocationIds,
  requireStaff,
} from "@/lib/auth/session";
import {
  LOCATION_COOKIE_MAX_AGE,
  LOCATION_COOKIE_NAME,
} from "@/lib/auth/location-cookie";
import { isUuid } from "@/lib/security/sanitize";

export async function switchLocationAction(locationId: string) {
  if (!isUuid(locationId)) {
    return { error: "Invalid location." };
  }

  const staff = await requireStaff();
  const accessible = await getStaffAccessibleLocationIds(staff);

  if (!accessible.includes(locationId)) {
    return { error: "You do not have access to this location." };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCATION_COOKIE_NAME, locationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LOCATION_COOKIE_MAX_AGE,
  });

  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");

  return { ok: true as const };
}
