import { buildKitchenTicketEscPos } from "@/lib/printer/format-kitchen-ticket";
import { buildReceiptEscPos } from "@/lib/printer/format-receipt";
import type { PaperWidth } from "@/lib/printer/escpos-builder";
import { loadSessionAllergyLabels } from "@/lib/printer/load-session-allergies";
import { buildProductTargetMap } from "@/lib/printer/product-targets";
import { encodePrintPayload } from "@/lib/printer/print-jobs";
import { resolveKitchenStationLabel } from "@/lib/printer/print-routing";
import { splitOrderItemsByTarget } from "@/lib/printer/split-items";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { parseOrderWithDetails } from "@/lib/supabase/query-rows";

type CloudPrintPayload = {
  orderId?: string;
  printerId?: string;
  jobType?: string;
  locationId?: string;
  orgId?: string;
  reprint?: boolean;
};

const ORDER_PRINT_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name)";

function resolveJobType(
  printFor: Array<"kitchen" | "bar" | "receipt">,
  explicit?: string
): "kitchen" | "receipt" {
  if (explicit === "kitchen" || explicit === "receipt") {
    return explicit;
  }
  const kitchenLike = printFor.includes("kitchen") || printFor.includes("bar");
  if (printFor.includes("receipt") && !kitchenLike) {
    return "receipt";
  }
  return "kitchen";
}

async function loadOrderForPrint(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string
) {
  const { data, error } = await admin
    .from("orders")
    .select(ORDER_PRINT_SELECT)
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new Error(`Order load failed: ${error?.message ?? "not found"}`);
  }

  return parseOrderWithDetails(data);
}

async function loadProductTargets(
  admin: ReturnType<typeof createAdminClient>,
  locationId: string
) {
  const [{ data: products }, { data: categories }] = await Promise.all([
    admin
      .from("products")
      .select("id, category_id")
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin.from("categories").select("id, printer_target").eq("location_id", locationId),
  ]);

  return buildProductTargetMap(
    (products ?? []) as Array<{ id: string; category_id: string | null }>,
    (categories ?? []) as Array<{
      id: string;
      printer_target: "kitchen" | "bar" | "receipt";
    }>
  );
}

export async function handleFulfillCloudPrint(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as CloudPrintPayload;
  const orderId = data.orderId;
  const printerId = data.printerId;

  if (!orderId || !printerId) {
    throw new Error("fulfill.cloud_print missing required fields");
  }

  const admin = createAdminClient();

  const { data: printer, error: printerError } = await admin
    .from("printer_configs")
    .select("id, location_id, type, paper_width, print_for")
    .eq("id", printerId)
    .maybeSingle();

  if (printerError || !printer) {
    logger.warn("Outbox fulfill.cloud_print skipped — printer not found", {
      orderId,
      printerId,
    });
    return;
  }

  const printerRow = printer as {
    id: string;
    location_id: string;
    type: string;
    paper_width: number;
    print_for: Array<"kitchen" | "bar" | "receipt">;
  };

  if (printerRow.type !== "cloud") {
    logger.info("Outbox fulfill.cloud_print skipped — not a cloud printer", {
      orderId,
      printerId,
      type: printerRow.type,
    });
    return;
  }

  const order = await loadOrderForPrint(admin, orderId);
  const jobType = resolveJobType(printerRow.print_for, data.jobType);
  const paperWidth = printerRow.paper_width as PaperWidth;
  const allergyLabels = await loadSessionAllergyLabels(admin, order.session_id);

  let escpos: Uint8Array;

  if (jobType === "receipt") {
    const orgId = data.orgId;
    if (!orgId) {
      throw new Error("fulfill.cloud_print receipt job missing orgId");
    }

    const [{ data: org }, { data: location }] = await Promise.all([
      admin.from("organizations").select("name, currency, logo_url").eq("id", orgId).single(),
      admin
        .from("locations")
        .select("address, city, in_person_payment_location")
        .eq("id", printerRow.location_id)
        .single(),
    ]);

    if (!org || !location) {
      throw new Error("fulfill.cloud_print org/location lookup failed");
    }

    escpos = buildReceiptEscPos(
      order,
      org as { name: string; logo_url?: string | null },
      location as {
        address: string | null;
        city: string | null;
        in_person_payment_location: "bar" | "counter" | "table";
      },
      paperWidth,
      (org as { currency: string }).currency,
      { logoUrl: (org as { logo_url?: string | null }).logo_url ?? null }
    );
  } else {
    const orgId = data.orgId;
    let orgName = "Kitchen";
    if (orgId) {
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      orgName = (org as { name: string } | null)?.name ?? orgName;
    }

    const productTargets = await loadProductTargets(admin, printerRow.location_id);
    const split = splitOrderItemsByTarget(order, productTargets);
    const printFor = printerRow.print_for;
    const items = [
      ...(printFor.includes("kitchen") ? split.kitchen : []),
      ...(printFor.includes("bar") ? split.bar : []),
    ];

    if (items.length === 0) {
      logger.info("Outbox fulfill.cloud_print skipped — no items for printer", {
        orderId,
        printerId,
      });
      return;
    }

    const stationLabel = resolveKitchenStationLabel(printFor);

    escpos = buildKitchenTicketEscPos(
      { ...order, order_items: items },
      orgName,
      paperWidth,
      stationLabel,
      { allergyLabels }
    );
  }

  const { error: insertError } = await admin.from("print_jobs").insert({
    printer_id: printerRow.id,
    location_id: printerRow.location_id,
    order_id: orderId,
    job_type: jobType,
    payload: encodePrintPayload(escpos),
    status: "pending",
  });

  if (insertError) {
    throw new Error(`print_jobs insert failed: ${insertError.message}`);
  }

  logger.info("Outbox fulfill.cloud_print queued job", {
    orderId,
    printerId,
    jobType,
    reprint: data.reprint ?? false,
  });
}
