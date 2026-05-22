import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  tableToken: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse({ tableToken: token, ...body });

    if (!parsed.success) {
      return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(`session:ip:${ip}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many session requests" },
        { status: 429 }
      );
    }

    const admin = createAdminClient();

    const { data: table } = await admin
      .from("tables")
      .select("id, name, location_id")
      .eq("qr_token", token)
      .eq("is_active", true)
      .single();

    if (!table) {
      return NextResponse.json(
        { error: "Sto nije pronađen." },
        { status: 404 }
      );
    }

    const tableRow = table as {
      id: string;
      name: string;
      location_id: string;
    };

    const maxAge = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - maxAge).toISOString();

    const { data: existing } = await admin
      .from("table_sessions")
      .select("*")
      .eq("table_id", tableRow.id)
      .eq("status", "active")
      .gte("opened_at", cutoff)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const row = existing as { id: string; session_token: string };
      return NextResponse.json({
        data: {
          sessionId: row.id,
          sessionToken: row.session_token,
          tableId: tableRow.id,
          tableName: tableRow.name,
          locationId: tableRow.location_id,
        },
      });
    }

    await admin
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("table_id", tableRow.id)
      .eq("status", "active");

    const { data: session, error } = await admin
      .from("table_sessions")
      .insert({
        table_id: tableRow.id,
        location_id: tableRow.location_id,
      })
      .select("id, session_token")
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: "Sesija nije kreirana." },
        { status: 500 }
      );
    }

    const sessionRow = session as { id: string; session_token: string };

    return NextResponse.json({
      data: {
        sessionId: sessionRow.id,
        sessionToken: sessionRow.session_token,
        tableId: tableRow.id,
        tableName: tableRow.name,
        locationId: tableRow.location_id,
      },
    });
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(
      { error: "Interna greška servera." },
      { status: 500 }
    );
  }
}
