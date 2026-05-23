import { z } from "zod";
import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { sendLanPrintJob } from "@/lib/printer/send-lan";
import { withRateLimit } from "@/lib/rate-limit";

const printSchema = z.object({
  ip: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  data: z.string().min(1),
});

function decodeBase64Payload(value: string): Uint8Array {
  const buffer = Buffer.from(value, "base64");
  return Uint8Array.from(buffer);
}

export const POST = withErrorHandler("printer-print-post", async (req, _ctx) => {
  try {
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!["owner", "manager", "staff", "kitchen"].includes(staff.role)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = printSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const payload = decodeBase64Payload(parsed.data.data);
    if (payload.length === 0) {
      return NextResponse.json(
        { error: "Empty print payload." },
        { status: 400 }
      );
    }

    if (payload.length > 512_000) {
      return NextResponse.json(
        { error: "Print payload too large." },
        { status: 400 }
      );
    }

    await sendLanPrintJob(parsed.data.ip, parsed.data.port, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("LAN print error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Print failed." },
      { status: 500 }
    );
  }
});
