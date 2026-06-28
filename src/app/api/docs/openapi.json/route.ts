import { buildOpenApiSpec } from "@/lib/api-docs/openapi-spec";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { withStaffRateLimit } from "@/lib/rate-limit";

async function canAccessDocs(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  const staff = await getCurrentStaff();
  return staff !== null;
}

export const GET = withErrorHandler("api-docs-openapi-get", async (req) => {
  const limited = await withStaffRateLimit(req);
  if (limited) return limited;

  if (!(await canAccessDocs())) {
    return apiError("Unauthorized.", 401);
  }
  return apiSuccess(buildOpenApiSpec());
});
