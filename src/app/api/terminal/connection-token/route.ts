import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe/client";
import {
  handleStripeCircuitError,
  loadTerminalOrgContext,
  withStripeCircuit,
} from "@/lib/stripe/terminal-context";

export const POST = withErrorHandler(
  "terminal-connection-token-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    if (!["owner", "manager", "staff", "waiter"].includes(staff.role)) {
      return apiError("Forbidden.", 403);
    }

    const orgContext = await loadTerminalOrgContext(staff);
    if ("error" in orgContext) {
      return apiError(orgContext.error, orgContext.status);
    }

    try {
      const stripe = getStripe();
      const token = await withStripeCircuit(() =>
        stripe.terminal.connectionTokens.create(
          {},
          { stripeAccount: orgContext.stripeAccountId }
        )
      );

      return apiSuccess({ secret: token.secret });
    } catch (error) {
      const circuit = handleStripeCircuitError(error);
      if (circuit) return circuit;
      throw error;
    }
  }
);
