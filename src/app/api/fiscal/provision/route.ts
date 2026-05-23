import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { provisionFiskalyTss } from "@/lib/fiscal/provision-tss";
import { isFiskalyConfigured } from "@/lib/fiscal/fiskaly";

async function requireProvisionStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export async function POST() {
  try {
    const staff = await requireProvisionStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!isFiskalyConfigured()) {
      return NextResponse.json(
        {
          error:
            "Fiskaly platform credentials are not configured (FISKALY_API_KEY / FISKALY_API_SECRET).",
        },
        { status: 503 }
      );
    }

    const result = await provisionFiskalyTss(staff.org_id);

    if (!result) {
      return NextResponse.json(
        { error: "Fiskaly is not configured on this platform." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      data: {
        tssId: result.tssId,
        clientId: result.clientId,
        skipped: result.skipped,
      },
    });
  } catch (error) {
    console.error("[fiskaly] Manual TSE provisioning failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "TSE provisioning failed.",
      },
      { status: 500 }
    );
  }
}
