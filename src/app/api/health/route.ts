import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const timestamp = new Date().toISOString();
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("organizations").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { status: "degraded", error: "database", timestamp, version },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "ok", timestamp, version });
  } catch {
    return NextResponse.json(
      { status: "degraded", error: "database", timestamp, version },
      { status: 503 }
    );
  }
}
