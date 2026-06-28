import { withErrorHandler } from "@/lib/api/with-error-handler";
import { logger } from "@/lib/logger";
import {
  decodePrintPayload,
  normalizePrinterMac,
} from "@/lib/printer/print-jobs";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const STAR_MEDIA_TYPE = "application/vnd.star.starprnt";

type CloudPrinterRow = {
  id: string;
  location_id: string;
};

type PrintJobRow = {
  id: string;
  payload: string;
  attempts: number;
};

async function findCloudPrinterByMac(mac: string): Promise<CloudPrinterRow | null> {
  const admin = createAdminClient();
  const normalized = normalizePrinterMac(mac);

  const { data, error } = await admin
    .from("printer_configs")
    .select("id, location_id, mac_address")
    .eq("type", "cloud")
    .not("mac_address", "is", null);

  if (error) {
    logger.error("CloudPRNT printer lookup failed", { error: error.message });
    return null;
  }

  const match = (data ?? []).find(
    (row) =>
      normalizePrinterMac((row as { mac_address: string }).mac_address) ===
      normalized
  );

  return match
    ? {
        id: (match as { id: string }).id,
        location_id: (match as { location_id: string }).location_id,
      }
    : null;
}

async function hasPendingJob(printerId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("print_jobs")
    .select("id", { count: "exact", head: true })
    .eq("printer_id", printerId)
    .eq("status", "pending");

  if (error) {
    logger.warn("CloudPRNT pending job check failed", {
      printerId,
      error: error.message,
    });
    return false;
  }

  return (count ?? 0) > 0;
}

function jobReadyResponse(ready: boolean) {
  return Response.json({
    jobReady: ready,
    mediaTypes: ready ? [STAR_MEDIA_TYPE] : [],
  });
}

export const POST = withErrorHandler("cloudprnt-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  let body: { statusCode?: unknown; printerMAC?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jobReadyResponse(false);
  }

  const printerMAC =
    typeof body.printerMAC === "string" ? body.printerMAC.trim() : "";
  if (!printerMAC) {
    return jobReadyResponse(false);
  }

  const printer = await findCloudPrinterByMac(printerMAC);
  if (!printer) {
    logger.warn("CloudPRNT poll from unknown printer", { printerMAC });
    return jobReadyResponse(false);
  }

  const ready = await hasPendingJob(printer.id);
  return jobReadyResponse(ready);
});

export const GET = withErrorHandler("cloudprnt-get", async (req) => {
  const mac = req.nextUrl.searchParams.get("mac")?.trim() ?? "";
  if (!mac) {
    return new Response("Missing mac.", { status: 400 });
  }

  const printer = await findCloudPrinterByMac(mac);
  if (!printer) {
    return new Response("Printer not found.", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: pending, error: pendingError } = await admin
    .from("print_jobs")
    .select("id, payload, attempts")
    .eq("printer_id", printer.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    logger.error("CloudPRNT job fetch failed", { error: pendingError.message });
    return new Response("Job lookup failed.", { status: 500 });
  }

  if (!pending) {
    return new Response("No pending job.", { status: 404 });
  }

  const job = pending as PrintJobRow;
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("print_jobs")
    .update({
      status: "printing",
      picked_at: now,
      attempts: job.attempts + 1,
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("payload")
    .maybeSingle();

  if (claimError || !claimed) {
    return new Response("Job already claimed.", { status: 409 });
  }

  const binary = decodePrintPayload((claimed as { payload: string }).payload);
  return new Response(Buffer.from(binary), {
    status: 200,
    headers: {
      "Content-Type": STAR_MEDIA_TYPE,
      "Cache-Control": "no-store",
    },
  });
});

export const DELETE = withErrorHandler("cloudprnt-delete", async (req) => {
  const mac = req.nextUrl.searchParams.get("mac")?.trim() ?? "";
  if (!mac) {
    return new Response("Missing mac.", { status: 400 });
  }

  const printer = await findCloudPrinterByMac(mac);
  if (!printer) {
    return new Response("Printer not found.", { status: 404 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("print_jobs")
    .update({ status: "done", done_at: now })
    .eq("printer_id", printer.id)
    .eq("status", "printing");

  if (error) {
    logger.error("CloudPRNT job complete failed", { error: error.message });
    return new Response("Update failed.", { status: 500 });
  }

  return new Response(null, { status: 200 });
});
