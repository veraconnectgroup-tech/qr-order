import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit/log";
import { buildStaffNotification } from "@/lib/denis/notifications/staff-notifications";
import { persistStaffNotification } from "@/lib/denis/notifications/persist-staff-notification";
import { sendEmail } from "@/lib/email/resend";
import {
  businessDayUtcBounds,
  listStandaloneLocations,
} from "@/lib/fiscal/daily-closing";
import { countsTowardRevenue } from "@/lib/orders/revenue";
import { logger } from "@/lib/logger";

export type FiscalComplianceSeverity = "critical" | "warning";

export type FiscalComplianceIssue = {
  severity: FiscalComplianceSeverity;
  code:
    | "missing_tse_signature"
    | "unsigned_journal_tx"
    | "bon_number_gap"
    | "revenue_order_unsigned";
  message: string;
  orderId?: string;
  fiscalTransactionId?: string;
  missingBonNumbers?: number[];
};

export type FiscalComplianceLocationResult = {
  locationId: string;
  orgId: string;
  businessDate: string;
  issues: FiscalComplianceIssue[];
  ordersChecked: number;
  journalTxChecked: number;
};

export type FiscalComplianceRunResult = {
  locations: FiscalComplianceLocationResult[];
  criticalCount: number;
  warningCount: number;
};

/** Detect missing sequential bon numbers (DSFinV-K gap detection). */
export function detectBonNumberGaps(bonNumbers: number[]): number[] {
  const sorted = [...new Set(bonNumbers.filter((n) => n > 0))].sort(
    (a, b) => a - b
  );
  if (sorted.length < 2) return [];

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    for (let missing = prev + 1; missing < curr; missing++) {
      gaps.push(missing);
    }
  }
  return gaps;
}

export async function verifyFiscalComplianceForLocation(
  admin: SupabaseClient,
  orgId: string,
  locationId: string,
  businessDate: string,
  timezone: string
): Promise<FiscalComplianceLocationResult> {
  const issues: FiscalComplianceIssue[] = [];
  const { startIso, endIso } = businessDayUtcBounds(businessDate, timezone);

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, order_number, status, tse_signature, payment_status")
    .eq("location_id", locationId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (ordersError) {
    throw new Error(`Compliance orders query failed: ${ordersError.message}`);
  }

  const revenueOrders = (orders ?? []).filter((row) =>
    countsTowardRevenue((row as { status: string }).status)
  ) as Array<{
    id: string;
    order_number: number;
    tse_signature: string | null;
    payment_status: string;
  }>;

  for (const order of revenueOrders) {
    if (!order.tse_signature?.trim()) {
      issues.push({
        severity: "critical",
        code: "revenue_order_unsigned",
        message: `Order #${order.order_number} has no TSE signature.`,
        orderId: order.id,
      });
    }
  }

  const { data: journalTxs, error: journalError } = await admin
    .from("fiscal_transactions")
    .select("id, order_id, tx_type, status, tse_signature, bon_number")
    .eq("location_id", locationId)
    .eq("org_id", orgId)
    .eq("business_date", businessDate)
    .in("tx_type", ["sale", "storno"]);

  if (journalError) {
    throw new Error(`Compliance journal query failed: ${journalError.message}`);
  }

  const txs = (journalTxs ?? []) as Array<{
    id: string;
    order_id: string | null;
    tx_type: string;
    status: string;
    tse_signature: string | null;
    bon_number: number | null;
  }>;

  for (const tx of txs) {
    if (tx.status === "signed" && !tx.tse_signature?.trim()) {
      issues.push({
        severity: "critical",
        code: "unsigned_journal_tx",
        message: `Signed fiscal transaction ${tx.id.slice(0, 8)}… has no TSE signature.`,
        fiscalTransactionId: tx.id,
        orderId: tx.order_id ?? undefined,
      });
    }
  }

  const bonNumbers = txs
    .map((tx) => tx.bon_number)
    .filter((n): n is number => typeof n === "number" && n > 0);

  const gaps = detectBonNumberGaps(bonNumbers);
  if (gaps.length > 0) {
    issues.push({
      severity: "warning",
      code: "bon_number_gap",
      message: `Bon number sequence gap detected: missing ${gaps.join(", ")}.`,
      missingBonNumbers: gaps,
    });
  }

  return {
    locationId,
    orgId,
    businessDate,
    issues,
    ordersChecked: revenueOrders.length,
    journalTxChecked: txs.length,
  };
}

export async function runFiscalComplianceCheck(
  admin: SupabaseClient,
  options?: { businessDate?: string; locationId?: string }
): Promise<FiscalComplianceRunResult> {
  const locations = options?.locationId
    ? await (async () => {
        const { data, error } = await admin
          .from("locations")
          .select("id, org_id, timezone")
          .eq("id", options.locationId!)
          .maybeSingle();
        if (error || !data) return [];
        const row = data as { id: string; org_id: string; timezone: string };
        return [
          {
            id: row.id,
            org_id: row.org_id,
            timezone: row.timezone || "Europe/Berlin",
          },
        ];
      })()
    : await listStandaloneLocations(admin);

  const results: FiscalComplianceLocationResult[] = [];

  for (const location of locations) {
    const businessDate =
      options?.businessDate ??
      (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
      })();

    try {
      const result = await verifyFiscalComplianceForLocation(
        admin,
        location.org_id,
        location.id,
        businessDate,
        location.timezone
      );
      results.push(result);
    } catch (err) {
      logger.error("Fiscal compliance check failed for location", {
        locationId: location.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let criticalCount = 0;
  let warningCount = 0;
  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.severity === "critical") criticalCount += 1;
      else warningCount += 1;
    }
  }

  return { locations: results, criticalCount, warningCount };
}

async function loadOwnerEmails(
  admin: SupabaseClient,
  orgId: string
): Promise<string[]> {
  const { data: owners } = await admin
    .from("staff")
    .select("email")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .eq("is_active", true)
    .is("deleted_at", null);

  return (owners ?? [])
    .map((row) => (row as { email: string | null }).email?.trim() || null)
    .filter((email): email is string => Boolean(email));
}

/** Dispatch CRITICAL fiscal alerts to audit log, staff notifications, and owner email. */
export async function dispatchFiscalComplianceAlerts(
  admin: SupabaseClient,
  result: FiscalComplianceRunResult
): Promise<{ alertsSent: number }> {
  let alertsSent = 0;

  for (const locationResult of result.locations) {
    const criticalIssues = locationResult.issues.filter(
      (issue) => issue.severity === "critical"
    );
    if (criticalIssues.length === 0) continue;

    await auditLog({
      orgId: locationResult.orgId,
      action: "fiscal",
      entityType: "fiscal_compliance",
      entityId: locationResult.locationId,
      newValue: {
        businessDate: locationResult.businessDate,
        criticalCount: criticalIssues.length,
        issues: criticalIssues,
      },
    });

    const summary = criticalIssues
      .slice(0, 3)
      .map((issue) => issue.message)
      .join(" · ");

    const notification = buildStaffNotification({
      type: "payment_issue",
      priority: "urgent",
      message: `[Fiskal CRITICAL] ${criticalIssues.length} TSE-Problem(e): ${summary}`,
      actionUrl: "/admin/tagesabschluss",
    });

    await persistStaffNotification(admin, {
      orgId: locationResult.orgId,
      locationId: locationResult.locationId,
      notification,
    });

    const ownerEmails = await loadOwnerEmails(admin, locationResult.orgId);
    const emailHtml = `<p>Fiskal-Compliance-Prüfung (${locationResult.businessDate}):</p><ul>${criticalIssues.map((issue) => `<li>${issue.message}</li>`).join("")}</ul><p>Admin → Tagesabschluss prüfen.</p>`;

    for (const email of ownerEmails) {
      await sendEmail({
        to: email,
        subject: `[Denis CRITICAL] TSE compliance — ${locationResult.businessDate}`,
        html: emailHtml,
      }).catch((err) => {
        logger.warn("Fiscal compliance owner email failed", {
          orgId: locationResult.orgId,
          email,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    alertsSent += 1;
    logger.error("Fiscal compliance CRITICAL alert", {
      locationId: locationResult.locationId,
      orgId: locationResult.orgId,
      businessDate: locationResult.businessDate,
      issues: criticalIssues,
    });
  }

  return { alertsSent };
}
