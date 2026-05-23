import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getCurrentStaff } from "@/lib/auth/session";
import { provisionFiskalyTss } from "@/lib/fiscal/provision-tss";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";

async function requireProvisionStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "fiscal");
    if (limited) return limited;

    const staff = await requireProvisionStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    if (!isFiskalyConfigured()) {
      return apiError(
        "Fiskaly platform credentials are not configured (FISKALY_API_KEY / FISKALY_API_SECRET).",
        503
      );
    }

    const result = await provisionFiskalyTss(staff.org_id);

    if (!result) {
      return apiError("Fiskaly is not configured on this platform.", 503);
    }

    return apiSuccess({
      tssId: result.tssId,
      clientId: result.clientId,
      skipped: result.skipped,
    });
  } catch (error) {
    logger.error("Manual TSE provisioning failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError(
      error instanceof Error ? error.message : "TSE provisioning failed.",
      500
    );
  }
}
