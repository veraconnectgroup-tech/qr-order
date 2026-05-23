import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripePlatformConfigured } from "@/lib/stripe/connect";
import { SettingsBoard } from "@/components/dashboard/settings-board";

export default async function SettingsPage() {
  const staff = await requireStaff();
  const locationId = await getStaffLocationId(staff);
  const admin = createAdminClient();

  const [{ data: org }, { data: location }, { data: sampleTable }] =
    await Promise.all([
    admin
      .from("organizations")
      .select(
        "name, slug, email, phone, description, currency, default_tax_percent, stripe_onboarded, stripe_account_id"
      )
      .eq("id", staff.org_id)
      .single(),
    locationId
      ? admin
          .from("locations")
          .select(
            "name, address, city, is_active, accepting_orders, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled, in_person_payment_location"
          )
          .eq("id", locationId)
          .single()
      : Promise.resolve({ data: null }),
    locationId
      ? admin
          .from("tables")
          .select("qr_token")
          .eq("location_id", locationId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const orgRow = org as {
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
    description: string | null;
    currency: string;
    default_tax_percent: number;
    stripe_onboarded: boolean;
    stripe_account_id: string | null;
  } | null;

  const canEdit = ["owner", "manager"].includes(staff.role);

  return (
    <SettingsBoard
      org={
        orgRow ?? {
          name: "Restaurant",
          slug: "",
          email: null,
          phone: null,
          description: null,
          currency: "EUR",
          default_tax_percent: 19,
          stripe_onboarded: false,
          stripe_account_id: null,
        }
      }
      location={
        location as {
          name: string;
          address: string | null;
          city: string | null;
          is_active: boolean;
          accepting_orders: boolean;
          payment_online_enabled: boolean;
          payment_at_bar_enabled: boolean;
          payment_card_at_table_enabled: boolean;
          in_person_payment_location: "bar" | "counter" | "table";
        } | null
      }
      staffName={staff.name}
      staffRole={staff.role}
      staffEmail={staff.email}
      canEdit={canEdit}
      stripePlatformReady={isStripePlatformConfigured()}
      sampleTableToken={
        (sampleTable as { qr_token: string } | null)?.qr_token ?? null
      }
    />
  );
}
