import type { SupabaseClient } from "@supabase/supabase-js";

export type SignedSaleFiscalTx = {
  id: string;
  register_id: string;
  org_id: string;
  location_id: string;
  fiskaly_tx_id: string | null;
};

export async function findSignedSaleFiscalTx(
  admin: SupabaseClient,
  orderId: string
): Promise<SignedSaleFiscalTx | null> {
  const { data, error } = await admin
    .from("fiscal_transactions")
    .select("id, register_id, org_id, location_id, fiskaly_tx_id")
    .eq("order_id", orderId)
    .eq("tx_type", "sale")
    .eq("status", "signed")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as SignedSaleFiscalTx;
}
