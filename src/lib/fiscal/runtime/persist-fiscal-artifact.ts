import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBelegHtml, type BelegData } from "@/lib/fiscal/beleg";
import { buildZBonHtml, type ZBonDisplayData } from "@/lib/fiscal/daily-closing";
import { archiveZBonToCloud } from "@/lib/fiscal/z-bon-archive";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database";

export type FiscalArtifactType = "beleg_html" | "z_bon_html";

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function findSignedSaleFiscalTransactionId(
  admin: SupabaseClient,
  orderId: string
): Promise<string | null> {
  const { data } = await admin
    .from("fiscal_transactions")
    .select("id")
    .eq("order_id", orderId)
    .eq("tx_type", "sale")
    .eq("status", "signed")
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

/** FJ-4: append-only beleg artifact linked to journal sale row. */
export async function persistBelegArtifact(
  admin: SupabaseClient,
  input: {
    orderId: string;
    fiscalTransactionId?: string | null;
    snapshot: BelegData;
    publicToken?: string | null;
  }
): Promise<{ persisted: boolean; artifactId?: string }> {
  const fiscalTransactionId =
    input.fiscalTransactionId ??
    (await findSignedSaleFiscalTransactionId(admin, input.orderId));

  if (!fiscalTransactionId) {
    return { persisted: false };
  }

  const { data: existing } = await admin
    .from("fiscal_artifacts")
    .select("id")
    .eq("fiscal_transaction_id", fiscalTransactionId)
    .maybeSingle();

  if (existing) {
    return { persisted: false, artifactId: (existing as { id: string }).id };
  }

  const html = await buildBelegHtml(input.snapshot);
  const contentHash = hashContent(html);
  const publicToken = input.publicToken?.trim() || randomUUID();

  const { data: inserted, error } = await admin
    .from("fiscal_artifacts")
    .insert({
      fiscal_transaction_id: fiscalTransactionId,
      artifact_type: "beleg_html",
      content_hash: contentHash,
      payload: { html, snapshot: input.snapshot } as Json,
      public_token: publicToken,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { persisted: false };
    }
    throw new Error(`fiscal_artifacts beleg insert failed: ${error.message}`);
  }

  logger.info("Fiscal beleg artifact persisted", {
    orderId: input.orderId,
    fiscalTransactionId,
    artifactId: (inserted as { id: string }).id,
  });

  return { persisted: true, artifactId: (inserted as { id: string }).id };
}

/** FJ-4: Z-Bon HTML artifact on signed z_closing journal row. */
export async function persistZBonArtifact(
  admin: SupabaseClient,
  fiscalTransactionId: string,
  display: ZBonDisplayData,
  options?: { orgId?: string; locationId?: string }
): Promise<{ persisted: boolean; artifactId?: string }> {
  const { data: existing } = await admin
    .from("fiscal_artifacts")
    .select("id")
    .eq("fiscal_transaction_id", fiscalTransactionId)
    .maybeSingle();

  if (existing) {
    return { persisted: false, artifactId: (existing as { id: string }).id };
  }

  const html = await buildZBonHtml(display);
  const contentHash = hashContent(html);

  const { data: inserted, error } = await admin
    .from("fiscal_artifacts")
    .insert({
      fiscal_transaction_id: fiscalTransactionId,
      artifact_type: "z_bon_html",
      content_hash: contentHash,
      payload: { html, display } as Json,
      public_token: randomUUID(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { persisted: false };
    }
    throw new Error(`fiscal_artifacts z_bon insert failed: ${error.message}`);
  }

  const artifactId = (inserted as { id: string }).id;

  if (options?.orgId && options?.locationId) {
    await archiveZBonToCloud(admin, {
      orgId: options.orgId,
      locationId: options.locationId,
      businessDate: display.businessDate,
      html,
      display,
    });
  }

  logger.info("Fiscal Z-Bon artifact persisted", {
    fiscalTransactionId,
    artifactId,
  });

  return { persisted: true, artifactId };
}
