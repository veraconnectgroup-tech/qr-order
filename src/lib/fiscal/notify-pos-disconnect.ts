import { sendEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyOwnersPosDisconnected(input: {
  orgId: string;
  locationId: string;
  locationName: string;
  provider: string;
}): Promise<void> {
  const admin = createAdminClient();

  const [{ data: owners }, { data: org }] = await Promise.all([
    admin
      .from("staff")
      .select("email, name")
      .eq("org_id", input.orgId)
      .eq("role", "owner")
      .eq("is_active", true)
      .is("deleted_at", null),
    admin.from("organizations").select("name").eq("id", input.orgId).single(),
  ]);

  const recipients = (owners ?? [])
    .map((row) => {
      const staff = row as { email: string | null; name: string | null };
      return staff.email?.trim() || null;
    })
    .filter((email): email is string => Boolean(email));

  if (!recipients.length) {
    logger.warn("POS disconnect: no owner email recipients", {
      orgId: input.orgId,
      locationId: input.locationId,
    });
    return;
  }

  const orgName = (org as { name: string } | null)?.name ?? "Ihr Betrieb";

  const html = `
    <p>Hallo,</p>
    <p>Die POS-Integration <strong>${input.provider}</strong> für den Standort
    <strong>${input.locationName}</strong> (${orgName}) wurde getrennt.</p>
    <p>Für diesen Standort gilt ggf. der <strong>Vorsystem-Modus</strong>:
    KassenSichV-Belege werden über das angeschlossene Kassensystem erstellt.
    Bitte prüfen Sie, ob die Trennung beabsichtigt war.</p>
    <p>— QR Order</p>
  `;

  for (const to of recipients) {
    await sendEmail({
      to,
      subject: `POS getrennt — ${input.locationName}`,
      html,
    });
  }
}
