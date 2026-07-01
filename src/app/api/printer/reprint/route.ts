import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { handleFulfillCloudPrint } from "@/lib/outbox/handlers/cloud-print";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  orderId: zUuid(),
  jobType: z.enum(["kitchen", "receipt"]).optional(),
});

export const POST = withErrorHandler("printer-reprint-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, location_id")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!order) {
    return apiError("Order not found.", 404);
  }

  const locationId = order.location_id as string;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .maybeSingle();

  const orgId = (location as { org_id: string } | null)?.org_id;
  if (!orgId) {
    return apiError("Location not found.", 404);
  }

  const { data: printers } = await admin
    .from("printer_configs")
    .select("id, print_for, type")
    .eq("location_id", locationId)
    .eq("type", "cloud");

  const jobType = parsed.data.jobType;
  const targets = (printers ?? []).filter((printer) => {
    const printFor = printer.print_for as string[];
    if (jobType === "receipt") return printFor.includes("receipt");
    if (jobType === "kitchen") {
      return printFor.includes("kitchen") || printFor.includes("bar");
    }
    return true;
  });

  if (targets.length === 0) {
    return apiError("No cloud printers configured.", 404);
  }

  for (const printer of targets) {
    await handleFulfillCloudPrint({
      orderId: parsed.data.orderId,
      printerId: printer.id as string,
      locationId,
      orgId,
      jobType,
      reprint: true,
    });
  }

  return apiSuccess({ reprinted: targets.length });
});
