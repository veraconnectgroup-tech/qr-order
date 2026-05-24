import { createAdminClient } from "@/lib/supabase/admin";
import type { PosInboundOrderDraft } from "@/lib/pos/inbound/types";
import type { PosProvider } from "@/lib/pos/pos-actions";

export type ResolvedPosTable = {
  tableId: string;
  tableName: string;
};

function readDefaultTableId(config: Record<string, unknown>): string | null {
  const value = config.default_table_id ?? config.defaultTableId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function resolvePosTable(input: {
  locationId: string;
  provider: PosProvider;
  config: Record<string, unknown>;
  draft: Pick<
    PosInboundOrderDraft,
    "tableName" | "externalTableId"
  >;
}): Promise<{ table: ResolvedPosTable } | { error: string }> {
  const admin = createAdminClient();
  const externalKey =
    input.draft.externalTableId?.trim() ||
    input.draft.tableName?.trim() ||
    null;

  if (externalKey) {
    const { data: mapping } = await admin
      .from("pos_table_mappings")
      .select("table_id")
      .eq("location_id", input.locationId)
      .eq("provider", input.provider)
      .eq("external_table_key", externalKey)
      .maybeSingle();

    if (mapping) {
      const tableId = (mapping as { table_id: string }).table_id;
      const { data: table } = await admin
        .from("tables")
        .select("id, name")
        .eq("id", tableId)
        .eq("location_id", input.locationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (table) {
        return {
          table: {
            tableId: (table as { id: string }).id,
            tableName: (table as { name: string }).name,
          },
        };
      }
    }
  }

  if (input.draft.tableName?.trim()) {
    const name = input.draft.tableName.trim();
    const { data: tables } = await admin
      .from("tables")
      .select("id, name")
      .eq("location_id", input.locationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .ilike("name", name);

    const exact = ((tables ?? []) as Array<{ id: string; name: string }>).find(
      (row) => row.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (exact) {
      return { table: { tableId: exact.id, tableName: exact.name } };
    }
  }

  const defaultTableId = readDefaultTableId(input.config);
  if (defaultTableId) {
    const { data: table } = await admin
      .from("tables")
      .select("id, name")
      .eq("id", defaultTableId)
      .eq("location_id", input.locationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (table) {
      return {
        table: {
          tableId: (table as { id: string }).id,
          tableName: (table as { name: string }).name,
        },
      };
    }
  }

  return {
    error: externalKey
      ? `Unknown POS table: ${externalKey}`
      : "POS order missing table reference",
  };
}

export async function resolvePosTableForClose(input: {
  locationId: string;
  provider: PosProvider;
  config: Record<string, unknown>;
  externalTableId?: string | null;
  tableName?: string | null;
}): Promise<{ table: ResolvedPosTable } | { error: string }> {
  return resolvePosTable({
    locationId: input.locationId,
    provider: input.provider,
    config: input.config,
    draft: {
      externalTableId: input.externalTableId,
      tableName: input.tableName,
    },
  });
}
