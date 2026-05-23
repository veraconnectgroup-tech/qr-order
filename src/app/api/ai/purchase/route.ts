import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getServerAppUrl } from "@/lib/app-url";
import { getCurrentStaff } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

const purchaseSchema = z.object({
  packageId: zUuid(),
});

async function requirePurchaseStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "payments");
    if (limited) return limited;

    const staff = await requirePurchaseStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const body = await req.json().catch(() => null);
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const admin = createAdminClient();

    const { data: pkg, error: packageError } = await admin
      .from("ai_credit_packages")
      .select("id, name, credits, price_cents, currency, is_active")
      .eq("id", parsed.data.packageId)
      .eq("is_active", true)
      .single();

    if (packageError || !pkg) {
      return apiError("Package not found.", 404);
    }

    const packageRow = pkg as {
      id: string;
      name: string;
      credits: number;
      price_cents: number;
      currency: string;
    };

    const { data: org } = await admin
      .from("organizations")
      .select("id, name, currency")
      .eq("id", staff.org_id)
      .single();

    if (!org) {
      return apiError("Organization not found.", 404);
    }

    const orgRow = org as { id: string; name: string; currency: string };
    const appUrl = getServerAppUrl();
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/admin/settings?ai=purchased`,
      cancel_url: `${appUrl}/admin/settings?ai=cancelled`,
      metadata: {
        orgId: orgRow.id,
        packageId: packageRow.id,
        credits: String(packageRow.credits),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (packageRow.currency || orgRow.currency || "EUR").toLowerCase(),
            unit_amount: packageRow.price_cents,
            product_data: {
              name: `AI Concierge — ${packageRow.name}`,
              description: `${packageRow.credits.toLocaleString("de-DE")} Kredite für ${orgRow.name}`,
            },
          },
        },
      ],
    });

    if (!session.url) {
      return apiError("Checkout could not be started.", 500);
    }

    return apiSuccess({ url: session.url });
  } catch (error) {
    logger.error("AI purchase checkout error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Checkout could not be started.", 500);
  }
}
