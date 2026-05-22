import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  tableToken: z.string().min(1),
  sessionToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const ip = getClientIp(req);
    const tableKey = `waiter:table:${parsed.data.tableToken}`;
    const ipKey = `waiter:ip:${ip}`;

    if (!checkRateLimit(tableKey, 100, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many waiter calls from this table" },
        { status: 429 }
      );
    }

    if (!checkRateLimit(ipKey, 50, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many waiter calls" },
        { status: 429 }
      );
    }

    const sessionResult = await validateTableSession(
      admin,
      parsed.data.tableToken,
      parsed.data.sessionToken
    );

    if ("error" in sessionResult) {
      return NextResponse.json(
        { error: sessionResult.error },
        { status: sessionResult.status }
      );
    }

    const { table: tableRow, session: sessionRow } = sessionResult.data;

    const { error } = await admin.from("waiter_calls").insert({
      table_id: tableRow.id,
      location_id: tableRow.location_id,
      session_id: sessionRow.id,
    });

    if (error) {
      return NextResponse.json({ error: "Poziv nije kreiran." }, { status: 500 });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("Waiter call error:", error);
    return NextResponse.json({ error: "Interna greška." }, { status: 500 });
  }
}
