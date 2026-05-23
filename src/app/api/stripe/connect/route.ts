import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getCurrentStaff } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeConnectConfig,
  createConnectAccountLink,
  stripeConnectErrorMessage,
  syncStripeConnectStatus,
} from "@/lib/stripe/connect";

async function requireConnectStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export async function GET(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await requireConnectStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    assertStripeConnectConfig();

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("id, stripe_account_id, stripe_onboarded")
      .eq("id", staff.org_id)
      .single();

    const orgRow = org as {
      id: string;
      stripe_account_id: string | null;
      stripe_onboarded: boolean;
    } | null;

    if (!orgRow?.stripe_account_id) {
      return apiSuccess({ onboarded: false, hasAccount: false });
    }

    const { onboarded } = await syncStripeConnectStatus(
      orgRow.id,
      orgRow.stripe_account_id
    );

    return apiSuccess({
      onboarded,
      hasAccount: true,
      accountId: orgRow.stripe_account_id,
    });
  } catch (error) {
    logger.error("Stripe connect sync error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError(stripeConnectErrorMessage(error), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await requireConnectStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    assertStripeConnectConfig();

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("id, email, stripe_account_id")
      .eq("id", staff.org_id)
      .single();

    if (!org) {
      return apiError("Organization not found.", 404);
    }

    const orgRow = org as {
      id: string;
      email: string | null;
      stripe_account_id: string | null;
    };

    const { accountId, url } = await createConnectAccountLink(
      orgRow.id,
      orgRow.email,
      orgRow.stripe_account_id
    );

    if (accountId !== orgRow.stripe_account_id) {
      await admin
        .from("organizations")
        .update({
          stripe_account_id: accountId,
          stripe_onboarded: false,
        })
        .eq("id", orgRow.id);
    }

    return apiSuccess({ url });
  } catch (error) {
    logger.error("Stripe connect error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError(stripeConnectErrorMessage(error), 500);
  }
}
