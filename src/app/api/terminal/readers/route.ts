import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requireStaffPermission } from "@/lib/auth/require-staff-permission";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import {
  ensureStripeTerminalLocation,
  handleStripeCircuitError,
  loadTerminalOrgContext,
  mapReaderStatus,
  staffCanAccessLocation,
  withStripeCircuit,
} from "@/lib/stripe/terminal-context";

const registerSchema = z.object({
  locationId: zUuid(),
  registrationCode: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80).optional(),
});

async function requireTerminalAdmin() {
  const staff = await requireStaffPermission("settings.manage");
  return { staff };
}

export const GET = withErrorHandler(
  "terminal-readers-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { staff } = await requireTerminalAdmin();

    const locationId = new URL(req.url).searchParams.get("locationId");
    if (!locationId) {
      return apiError("locationId is required.", 400);
    }

    if (!(await staffCanAccessLocation(staff, locationId))) {
      return apiError("Forbidden.", 403);
    }

    const orgContext = await loadTerminalOrgContext(staff);
    if ("error" in orgContext) {
      return apiError(orgContext.error, orgContext.status);
    }

    const admin = createAdminClient();
    const stripe = getStripe();

    try {
      const readers = await withStripeCircuit(() =>
        stripe.terminal.readers.list(
          { limit: 100 },
          { stripeAccount: orgContext.stripeAccountId }
        )
      );

      const now = new Date().toISOString();
      for (const reader of readers.data) {
        const status = mapReaderStatus(reader.status);
        await admin.from("terminal_readers").upsert(
          {
            location_id: locationId,
            org_id: orgContext.orgId,
            stripe_reader_id: reader.id,
            label: reader.label ?? "Reader",
            status,
            last_seen_at: status === "online" ? now : null,
            updated_at: now,
          },
          { onConflict: "location_id,stripe_reader_id" }
        );
      }

      const { data: rows } = await admin
        .from("terminal_readers")
        .select("id, stripe_reader_id, label, status, last_seen_at, created_at")
        .eq("location_id", locationId)
        .order("label");

      return apiSuccess({
        readers: rows ?? [],
        stripeReaders: readers.data.map((reader) => ({
          id: reader.id,
          label: reader.label,
          status: reader.status,
          deviceType: reader.device_type,
        })),
      });
    } catch (error) {
      const circuit = handleStripeCircuitError(error);
      if (circuit) return circuit;
      throw error;
    }
  }
);

export const POST = withErrorHandler(
  "terminal-readers-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { staff } = await requireTerminalAdmin();

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    if (!(await staffCanAccessLocation(staff, parsed.data.locationId))) {
      return apiError("Forbidden.", 403);
    }

    const orgContext = await loadTerminalOrgContext(staff);
    if ("error" in orgContext) {
      return apiError(orgContext.error, orgContext.status);
    }

    const admin = createAdminClient();
    const { data: location } = await admin
      .from("locations")
      .select("name")
      .eq("id", parsed.data.locationId)
      .maybeSingle();

    const locationName = (location as { name: string } | null)?.name ?? "Location";
    const stripe = getStripe();

    try {
      const stripeLocationId = await ensureStripeTerminalLocation({
        locationId: parsed.data.locationId,
        locationName,
        stripeAccountId: orgContext.stripeAccountId,
      });

      const reader = await withStripeCircuit(() =>
        stripe.terminal.readers.create(
          {
            registration_code: parsed.data.registrationCode,
            label: parsed.data.label ?? "Reader",
            location: stripeLocationId,
          },
          { stripeAccount: orgContext.stripeAccountId }
        )
      );

      const status = mapReaderStatus(reader.status);
      const now = new Date().toISOString();

      await admin.from("terminal_readers").upsert(
        {
          location_id: parsed.data.locationId,
          org_id: orgContext.orgId,
          stripe_reader_id: reader.id,
          label: reader.label ?? parsed.data.label ?? "Reader",
          status,
          last_seen_at: status === "online" ? now : null,
          updated_at: now,
        },
        { onConflict: "location_id,stripe_reader_id" }
      );

      return apiSuccess({
        reader: {
          id: reader.id,
          label: reader.label,
          status: reader.status,
          deviceType: reader.device_type,
        },
      });
    } catch (error) {
      const circuit = handleStripeCircuitError(error);
      if (circuit) return circuit;
      throw error;
    }
  }
);

export const DELETE = withErrorHandler(
  "terminal-readers-delete",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const { staff } = await requireTerminalAdmin();

    const body = await req.json();
    const parsed = z
      .object({
        locationId: zUuid(),
        stripeReaderId: z.string().trim().min(1),
      })
      .safeParse(body);

    if (!parsed.success) {
      return apiError("Invalid input.", 400, parsed.error.flatten());
    }

    if (!(await staffCanAccessLocation(staff, parsed.data.locationId))) {
      return apiError("Forbidden.", 403);
    }

    const orgContext = await loadTerminalOrgContext(staff);
    if ("error" in orgContext) {
      return apiError(orgContext.error, orgContext.status);
    }

    const admin = createAdminClient();
    const stripe = getStripe();

    try {
      await withStripeCircuit(() =>
        stripe.terminal.readers.del(parsed.data.stripeReaderId, {
          stripeAccount: orgContext.stripeAccountId,
        })
      );

      await admin
        .from("terminal_readers")
        .delete()
        .eq("location_id", parsed.data.locationId)
        .eq("stripe_reader_id", parsed.data.stripeReaderId);

      return apiSuccess({ removed: true });
    } catch (error) {
      const circuit = handleStripeCircuitError(error);
      if (circuit) return circuit;
      throw error;
    }
  }
);
