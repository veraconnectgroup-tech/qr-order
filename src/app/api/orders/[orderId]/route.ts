import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeText } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { processRefund } from "@/lib/stripe/refund";
import { maybeSendOrderReceipt } from "@/lib/email/send-order-receipt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const sessionToken = req.nextUrl.searchParams.get("sessionToken");

  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("*, order_items(*, order_item_modifiers(*)), tables(name)")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const orderBase = order as unknown as {
    session_id: string | null;
    id: string;
    order_number: number;
    status: string;
    payment_status: string;
    subtotal: number;
    tax_amount: number;
    tax_percent: number;
    total: number;
    rejection_reason: string | null;
    estimated_prep_minutes: number | null;
    created_at: string;
    accepted_at: string | null;
    preparing_at: string | null;
    ready_at: string | null;
    delivered_at: string | null;
    order_items: Array<{
      product_name: string;
      quantity: number;
      total: number;
      notes: string | null;
      order_item_modifiers: Array<{ modifier_name: string; price: number }>;
    }>;
    tables: { name: string } | null;
  };

  if (!orderBase.session_id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: session } = await admin
    .from("table_sessions")
    .select("session_token")
    .eq("id", orderBase.session_id)
    .single();

  if (!session || (session as { session_token: string }).session_token !== sessionToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ data: orderBase });
}

const statusSchema = z.object({
  status: z.enum(["accepted", "preparing", "ready", "delivered", "rejected"]),
  rejectionReason: z.string().max(500).optional(),
});

type StaffAccess = {
  order: {
    id: string;
    location_id: string;
    status: string;
    payment_status: string;
    payment_method: string;
    stripe_payment_intent_id: string | null;
    total: number;
    created_at: string;
  };
  staff: {
    id: string;
    org_id: string;
    location_id: string | null;
    role: string;
  };
};

async function verifyStaffOrderAccess(
  orderId: string
): Promise<StaffAccess | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, location_id, status, payment_status, payment_method, stripe_payment_intent_id, total, created_at"
    )
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const orderRow = order as StaffAccess["order"];

  const { data: staff } = await supabase
    .from("staff")
    .select("id, org_id, location_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) return null;

  const staffRow = staff as StaffAccess["staff"];

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", orderRow.location_id)
    .single();

  if (!location) return null;

  if ((location as { org_id: string }).org_id !== staffRow.org_id) {
    return null;
  }

  if (
    staffRow.location_id &&
    staffRow.location_id !== orderRow.location_id
  ) {
    return null;
  }

  return { order: orderRow, staff: staffRow };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const access = await verifyStaffOrderAccess(orderId);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { status, rejectionReason } = parsed.data;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const updates: Partial<{
    status: string;
    accepted_at: string;
    preparing_at: string;
    ready_at: string;
    delivered_at: string;
    rejection_reason: string | null;
    payment_status: string;
  }> = { status };

  if (status === "accepted") updates.accepted_at = now;
  if (status === "preparing") updates.preparing_at = now;
  if (status === "ready") updates.ready_at = now;
  if (status === "delivered") updates.delivered_at = now;

    if (
      status === "delivered" &&
      access.order.payment_status === "pending" &&
      access.order.payment_method !== "online" &&
      access.order.payment_method !== "unset"
    ) {
    updates.payment_status = "paid";
  }

  if (status === "rejected") {
    updates.rejection_reason = rejectionReason
      ? sanitizeText(rejectionReason, 500)
      : null;

    if (
      access.order.payment_status === "paid" &&
      access.order.stripe_payment_intent_id
    ) {
      const refundResult = await processRefund(
        access.order,
        access.staff.id,
        rejectionReason ?? "Order rejected by staff"
      );

      if ("error" in refundResult) {
        return NextResponse.json(
          { error: refundResult.error },
          { status: 400 }
        );
      }
    }
  }

  const { error } = await admin
    .from("orders")
    .update(updates as never)
    .eq("id", orderId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (status === "delivered") {
    maybeSendOrderReceipt(orderId).catch((err) =>
      console.error("Receipt email failed:", err)
    );
  }

  return NextResponse.json({ data: { ok: true } });
}
