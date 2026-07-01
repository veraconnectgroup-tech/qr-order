import type { Staff } from "@/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import {
  handleStripeCircuitError,
  withStripeCircuit,
} from "@/lib/stripe/with-stripe-circuit";

export type {
  TerminalPaymentPhase,
} from "@/lib/stripe/terminal-guest-copy";
export {
  isTerminalPaymentEligible,
  mapTerminalPaymentStatus,
  resolveGuestTerminalPrompt,
} from "@/lib/stripe/terminal-guest-copy";

export type TerminalOrgContext = {
  orgId: string;
  stripeAccountId: string;
  currency: string;
  platformFeePercent: number | null;
  platformFeeFixed: number | null;
};

export async function loadTerminalOrgContext(
  staff: Staff
): Promise<TerminalOrgContext | { error: string; status: number }> {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, stripe_account_id, stripe_onboarded, currency, platform_fee_percent, platform_fee_fixed"
    )
    .eq("id", staff.org_id)
    .maybeSingle();

  const orgRow = org as {
    id: string;
    stripe_account_id: string | null;
    stripe_onboarded: boolean;
    currency: string;
    platform_fee_percent: number | null;
    platform_fee_fixed: number | null;
  } | null;

  if (!orgRow?.stripe_onboarded || !orgRow.stripe_account_id) {
    return { error: "Stripe Connect is not configured.", status: 409 };
  }

  return {
    orgId: orgRow.id,
    stripeAccountId: orgRow.stripe_account_id,
    currency: orgRow.currency ?? "EUR",
    platformFeePercent: orgRow.platform_fee_percent,
    platformFeeFixed: orgRow.platform_fee_fixed,
  };
}

export async function staffCanAccessLocation(
  staff: Staff,
  locationId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .maybeSingle();

  const row = location as { org_id: string } | null;
  if (!row || row.org_id !== staff.org_id) return false;
  if (staff.location_id && staff.location_id !== locationId) return false;
  return true;
}

export async function ensureStripeTerminalLocation(input: {
  locationId: string;
  locationName: string;
  stripeAccountId: string;
}): Promise<string> {
  const admin = createAdminClient();

  const { data: location } = await admin
    .from("locations")
    .select("stripe_terminal_location_id, address, city, postal_code, country")
    .eq("id", input.locationId)
    .maybeSingle();

  const loc = location as {
    stripe_terminal_location_id: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string;
  } | null;

  if (loc?.stripe_terminal_location_id) {
    return loc.stripe_terminal_location_id;
  }

  const stripe = getStripe();
  const terminalLocation = await withStripeCircuit(() =>
    stripe.terminal.locations.create(
      {
        display_name: input.locationName.slice(0, 100),
        address: {
          line1: loc?.address?.trim() || "Address pending",
          city: loc?.city?.trim() || "Hamburg",
          postal_code: loc?.postal_code?.trim() || "20095",
          country: (loc?.country ?? "DE").slice(0, 2).toUpperCase(),
        },
      },
      { stripeAccount: input.stripeAccountId }
    )
  );

  await admin
    .from("locations")
    .update({ stripe_terminal_location_id: terminalLocation.id } as never)
    .eq("id", input.locationId);

  return terminalLocation.id;
}

export function mapReaderStatus(
  status: string | null | undefined
): "online" | "offline" {
  return status === "online" ? "online" : "offline";
}

export { handleStripeCircuitError, withStripeCircuit };
