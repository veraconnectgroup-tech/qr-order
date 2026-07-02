import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { safeJsonParse } from "@/lib/api/safe-json";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  assertRoleCanSetProductAvailability,
  loadProductForAvailability,
  setProductAvailabilityTx,
} from "@/lib/products/eighty-six";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  available: z.boolean(),
});

async function verifyStaffProductAccess(productId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const product = await loadProductForAvailability(admin, productId);
  if (!product) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, user_id, org_id, location_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!staff) return null;

  const staffRow = staff as {
    id: string;
    user_id: string;
    org_id: string;
    location_id: string | null;
    role: string;
  };

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", product.location_id)
    .single();

  if (!location) return null;

  if ((location as { org_id: string }).org_id !== staffRow.org_id) {
    return null;
  }

  if (
    staffRow.location_id &&
    staffRow.location_id !== product.location_id
  ) {
    return null;
  }

  return { product, staff: staffRow, userId: user.id };
}

export const PATCH = withErrorHandler(
  "products-productId-availability-patch",
  async (req, ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { productId } = await ctx.params;
    if (!isUuid(productId)) {
      return apiError("Invalid product id.", 400);
    }

    const access = await verifyStaffProductAccess(productId);
    if (!access) {
      return apiError("Unauthorized.", 401);
    }

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid request body.", 400);
    }

    const { available } = parsed.data;
    const roleCheck = assertRoleCanSetProductAvailability({
      role: access.staff.role,
      menuSection: access.product.menu_section,
      makingUnavailable: !available,
    });

    if (!roleCheck.ok) {
      return apiError(roleCheck.reason, 403);
    }

    const admin = createAdminClient();
    const result = await setProductAvailabilityTx(admin, {
      product: access.product,
      available,
      orgId: access.staff.org_id,
      staffUserId: access.userId,
      request: req,
    });

    if (!result.ok) {
      return apiError(result.error, 500);
    }

    return apiSuccess({
      productId: access.product.id,
      productName: access.product.name,
      isAvailable: available,
      changed: result.changed,
    });
  }
);
