import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const sessionToken = req.nextUrl.searchParams.get("sessionToken");
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tableToken = req.nextUrl.searchParams.get("tableToken");
  if (!tableToken) {
    return NextResponse.json({ error: "Invalid table." }, { status: 400 });
  }

  const admin = createAdminClient();
  const sessionResult = await validateTableSession(
    admin,
    tableToken,
    sessionToken
  );

  if ("error" in sessionResult) {
    return NextResponse.json(
      { error: sessionResult.error },
      { status: sessionResult.status }
    );
  }

  const { session } = sessionResult.data;

  const { data: orders } = await admin
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, subtotal, tax_amount, total, created_at"
    )
    .eq("session_id", session.id)
    .not("status", "in", '("rejected","cancelled")')
    .order("created_at", { ascending: true });

  const rows =
    (orders as Array<{
      id: string;
      order_number: number;
      status: string;
      payment_status: string;
      payment_method: string;
      subtotal: number;
      tax_amount: number;
      total: number;
      created_at: string;
    }>) ?? [];

  const unpaid = rows.filter((o) => o.payment_status !== "paid");
  const amountDue = unpaid.reduce((sum, o) => sum + Number(o.total), 0);
  const subtotal = unpaid.reduce((sum, o) => sum + Number(o.subtotal), 0);
  const taxAmount = unpaid.reduce((sum, o) => sum + Number(o.tax_amount), 0);

  return NextResponse.json({
    data: {
      orders: rows,
      unpaidOrderIds: unpaid.map((o) => o.id),
      amountDue,
      subtotal,
      taxAmount,
      orderCount: rows.length,
      unpaidCount: unpaid.length,
    },
  });
}

const checkoutSchema = z.object({
  sessionToken: z.string().min(1),
  paymentMethod: z.enum(["online", "at_bar", "card_at_table"]),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { sessionToken, paymentMethod } = parsed.data;

  const { data: session } = await admin
    .from("table_sessions")
    .select("id, session_token")
    .eq("session_token", sessionToken)
    .eq("status", "active")
    .single();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sessionRow = session as { id: string };

  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("session_id", sessionRow.id)
    .neq("payment_status", "paid")
    .not("status", "in", '("rejected","cancelled")');

  const orderIds = ((orders as { id: string }[]) ?? []).map((o) => o.id);
  if (orderIds.length === 0) {
    return NextResponse.json({ error: "Nothing to pay." }, { status: 400 });
  }

  const { error } = await admin
    .from("orders")
    .update({ payment_method: paymentMethod })
    .in("id", orderIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      ok: true,
      orderIds,
      paymentMethod,
    },
  });
}
