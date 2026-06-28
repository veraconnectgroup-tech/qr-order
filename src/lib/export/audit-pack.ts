import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildZBonHtml,
  loadZBonDisplayData,
} from "@/lib/fiscal/daily-closing";
import {
  buildDsfinvkCsvFiles,
  generateDsfinvkExport,
  type DsfinvkExportContext,
} from "@/lib/export/dsfinvk";

function isoDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function auditReadme(
  locationName: string,
  from: Date,
  to: Date,
  zBonCount: number
): string {
  const fmt = (d: Date) => isoDateOnly(d);
  return [
    "Finanzamt Audit Pack — Vera / Denis",
    "===================================",
    "",
    `Standort: ${locationName}`,
    `Zeitraum: ${fmt(from)} – ${fmt(to)}`,
    "",
    "Inhalt:",
    "- dsfinvk/*.csv — DSFinV-K 2.3 Export (Bonkopf, Bonpos, TSE, Z-Bons)",
    `- z-bons/*.html — Z-Bon Tagesabschlüsse mit TSE-Signatur (${zBonCount} Dateien)`,
    "",
    "Hinweis: Z-Bon HTML ist druckfertig (Browser → Drucken → PDF speichern).",
    "Generiert gemäß KassenSichV / GoBD.",
    "",
  ].join("\r\n");
}

export function auditPackFilename(
  locationName: string,
  from: Date,
  to: Date
): string {
  const fmt = (d: Date) => isoDateOnly(d);
  const safeName = locationName
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
  return `Finanzamt_Audit_${safeName || "Location"}_${fmt(from)}_${fmt(to)}.zip`;
}

/** Finanzamt audit pack: DSFinV-K CSVs + signed Z-Bon HTML per business day. */
export async function generateFinanzamtAuditPack(
  organizationId: string,
  locationId: string,
  fromDate: Date,
  toDate: Date,
  locationName: string
): Promise<Buffer> {
  const dsfinvkZipBuffer = await generateDsfinvkExport(
    organizationId,
    locationId,
    fromDate,
    toDate
  );

  const sourceZip = await JSZip.loadAsync(dsfinvkZipBuffer);
  const zip = new JSZip();
  const dsfinvkFolder = zip.folder("dsfinvk");

  for (const [name, file] of Object.entries(sourceZip.files)) {
    if (file.dir) continue;
    const content = await file.async("string");
    dsfinvkFolder?.file(name, content);
  }

  const admin = createAdminClient();
  const fromIso = isoDateOnly(fromDate);
  const toIso = isoDateOnly(toDate);

  const { data: closings, error: closingsError } = await admin
    .from("daily_closings" as never)
    .select("id, business_date, fiscal_transaction_id")
    .eq("location_id", locationId)
    .eq("org_id", organizationId)
    .gte("business_date", fromIso)
    .lte("business_date", toIso)
    .order("business_date", { ascending: true });

  if (closingsError) {
    throw new Error("Daily closings could not be loaded for audit pack.");
  }

  const zBonFolder = zip.folder("z-bons");
  let zBonCount = 0;

  for (const raw of closings ?? []) {
    const closing = raw as {
      id: string;
      business_date: string;
      fiscal_transaction_id: string | null;
    };

    let html: string | null = null;

    if (closing.fiscal_transaction_id) {
      const { data: artifact } = await admin
        .from("fiscal_artifacts")
        .select("payload")
        .eq("fiscal_transaction_id", closing.fiscal_transaction_id)
        .eq("artifact_type", "z_bon_html")
        .maybeSingle();

      const payload = (artifact as { payload: { html?: string } } | null)
        ?.payload;
      html = payload?.html ?? null;
    }

    if (!html) {
      const display = await loadZBonDisplayData(
        admin,
        closing.id,
        organizationId
      );
      if (display) {
        html = await buildZBonHtml(display);
      }
    }

    if (html && zBonFolder) {
      zBonFolder.file(`Z-Bon_${closing.business_date}.html`, html);
      zBonCount += 1;
    }
  }

  zip.file(
    "README.txt",
    auditReadme(locationName, fromDate, toDate, zBonCount)
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Exposed for tests — validate DSFinV-K context produces expected file set. */
export function validateDsfinvkExportContext(ctx: DsfinvkExportContext): {
  valid: boolean;
  fileCount: number;
  orderCount: number;
} {
  const files = buildDsfinvkCsvFiles(ctx);
  const orderCount = ctx.orders.length + ctx.stornoBonOrders.length;
  return {
    valid: Object.keys(files).length === 11 && orderCount >= 0,
    fileCount: Object.keys(files).length,
    orderCount,
  };
}
