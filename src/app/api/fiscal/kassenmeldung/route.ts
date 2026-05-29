export const maxDuration = 15;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import {
  buildKassenmeldungExportCsv,
  createFiscalRegistration,
  listFiscalRegistrations,
} from "@/lib/fiscal/kassenmeldung";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/rate-limit";

async function requireFiscalAdmin() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export const GET = withErrorHandler(
  "fiscal-kassenmeldung-get",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "fiscal");
    if (limited) return limited;

    const staff = await requireFiscalAdmin();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const admin = createAdminClient();
    const locationId = await getStaffLocationId(staff);
    const exportCsv = new URL(req.url).searchParams.get("export") === "csv";

    const registrations = await listFiscalRegistrations(
      admin,
      staff.org_id,
      locationId ?? undefined
    );

    if (exportCsv) {
      const csv = buildKassenmeldungExportCsv(registrations);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="kassenmeldungen.csv"',
        },
      });
    }

    return apiSuccess({ registrations });
  }
);

export const POST = withErrorHandler(
  "fiscal-kassenmeldung-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "fiscal");
    if (limited) return limited;

    const staff = await requireFiscalAdmin();
    if (!staff) {
      return apiError("Unauthorized.", 401);
    }

    const body = (await req.json()) as {
      locationId?: string;
      registerId?: string;
      kassenId?: string;
      inbetriebnahmeAt?: string;
      tssSerial?: string | null;
      elsterKennung?: string | null;
    };

    if (!body.locationId || !body.registerId || !body.kassenId || !body.inbetriebnahmeAt) {
      return apiError("locationId, registerId, kassenId, inbetriebnahmeAt required.", 400);
    }

    const admin = createAdminClient();

    const { data: register } = await admin
      .from("fiscal_registers")
      .select("id, org_id, location_id")
      .eq("id", body.registerId)
      .eq("org_id", staff.org_id)
      .eq("location_id", body.locationId)
      .maybeSingle();

    if (!register) {
      return apiError("Register not found for this location.", 404);
    }

    const result = await createFiscalRegistration(admin, {
      orgId: staff.org_id,
      locationId: body.locationId,
      registerId: body.registerId,
      kassenId: body.kassenId,
      inbetriebnahmeAt: body.inbetriebnahmeAt,
      tssSerial: body.tssSerial,
      elsterKennung: body.elsterKennung,
    });

    return apiSuccess(result);
  }
);
