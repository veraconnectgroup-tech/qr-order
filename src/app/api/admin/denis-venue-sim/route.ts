import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runVenueSimForSession } from "@/lib/admin/denis-venue-sim";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withErrorHandler(
  "admin-denis-venue-sim-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid input.", 400, undefined, noCache());
    }

    const result = await runVenueSimForSession(
      body as Parameters<typeof runVenueSimForSession>[0]
    );

    if (!result.ok) {
      return apiError(result.error, 400, undefined, noCache());
    }

    return apiSuccess({ report: result.report }, 200, noCache());
  }
);
