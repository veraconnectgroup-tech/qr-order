import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { buildProductTargetMap } from "@/lib/printer/product-targets";
import { zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const printerTargetSchema = z.enum(["kitchen", "bar", "receipt"]);

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["usb", "lan"]),
  ip_address: z.string().trim().optional().nullable(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  paper_width: z.coerce.number().refine((v) => v === 58 || v === 80),
  auto_print: z.boolean().optional(),
  print_for: z.array(printerTargetSchema).min(1),
  is_default: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({
  id: zUuid(),
});

function isManager(staff: { role: string }) {
  return ["owner", "manager"].includes(staff.role);
}

async function requireLocationId(
  staff: NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>
) {
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return null;
  }
  return locationId;
}

export const GET = withErrorHandler(
  "printer-configs-get",
  async (_req, _ctx) => {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }

  const locationId = await requireLocationId(staff);
  if (!locationId) {
    return apiError("No location assigned.", 400);
  }

  const admin = createAdminClient();
  const [{ data: configs }, { data: products }, { data: categories }, { data: location }] =
    await Promise.all([
      admin
        .from("printer_configs")
        .select("*")
        .eq("location_id", locationId)
        .order("created_at", { ascending: true }),
      admin
        .from("products")
        .select("id, category_id")
        .eq("location_id", locationId)
        .is("deleted_at", null),
      admin
        .from("categories")
        .select("id, printer_target")
        .eq("location_id", locationId),
      admin
        .from("locations")
        .select("address, city, in_person_payment_location")
        .eq("id", locationId)
        .single(),
    ]);

  const productTargets = buildProductTargetMap(
    (products ?? []) as Array<{ id: string; category_id: string | null }>,
    (categories ?? []) as Array<{
      id: string;
      printer_target: "kitchen" | "bar" | "receipt";
    }>
  );

  const locationRow = location as {
    address: string | null;
    city: string | null;
    in_person_payment_location: "bar" | "counter" | "table";
  } | null;

  return apiSuccess({
    configs: configs ?? [],
    productTargets,
    location: {
      address: locationRow?.address ?? null,
      city: locationRow?.city ?? null,
      in_person_payment_location:
        locationRow?.in_person_payment_location ?? "bar",
    },
  });
});

export const POST = withErrorHandler(
  "printer-configs-post",
  async (req, _ctx) => {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }
  if (!isManager(staff)) {
    return apiError("Unauthorized.", 403);
  }

  const locationId = await requireLocationId(staff);
  if (!locationId) {
    return apiError("No location assigned.", 400);
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400, parsed.error.flatten());
  }

  if (parsed.data.type === "lan" && !parsed.data.ip_address) {
    return apiError("LAN printers require an IP address.", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("printer_configs")
    .insert({
      location_id: locationId,
      name: parsed.data.name,
      type: parsed.data.type,
      ip_address: parsed.data.type === "lan" ? parsed.data.ip_address : null,
      port: parsed.data.port ?? 9100,
      paper_width: parsed.data.paper_width,
      auto_print: parsed.data.auto_print ?? true,
      print_for: parsed.data.print_for,
      is_default: parsed.data.is_default ?? false,
    })
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data, 201);
});

export const PUT = withErrorHandler(
  "printer-configs-put",
  async (req, _ctx) => {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }
  if (!isManager(staff)) {
    return apiError("Unauthorized.", 403);
  }

  const locationId = await requireLocationId(staff);
  if (!locationId) {
    return apiError("No location assigned.", 400);
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400, parsed.error.flatten());
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("printer_configs")
    .select("id, location_id, type")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!existing || (existing as { location_id: string }).location_id !== locationId) {
    return apiError("Printer not found.", 404);
  }

  const nextType = parsed.data.type ?? (existing as { type: string }).type;
  if (nextType === "lan" && parsed.data.ip_address === null) {
    return apiError("LAN printers require an IP address.", 400);
  }

  const { id, ...updates } = parsed.data;
  const { data, error } = await admin
    .from("printer_configs")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
});

export const DELETE = withErrorHandler(
  "printer-configs-delete",
  async (req, _ctx) => {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401);
  }
  if (!isManager(staff)) {
    return apiError("Unauthorized.", 403);
  }

  const locationId = await requireLocationId(staff);
  if (!locationId) {
    return apiError("No location assigned.", 400);
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return apiError("Missing printer id.", 400);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("printer_configs")
    .select("id, location_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || (existing as { location_id: string }).location_id !== locationId) {
    return apiError("Printer not found.", 404);
  }

  const { error } = await admin.from("printer_configs").delete().eq("id", id);
  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ deleted: true });
});
