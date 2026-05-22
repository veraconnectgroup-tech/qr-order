import { NextRequest, NextResponse } from "next/server";
import { createOrderFromCart, createOrderSchema } from "@/lib/orders/create-order";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const ipKey = `order:ip:${ip}`;

    // Light abuse guard only — guests may place many orders per session.
    if (!checkRateLimit(ipKey, 120, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many orders" }, { status: 429 });
    }

    const result = await createOrderFromCart(parsed.data);

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Order could not be created. Please try again." },
      { status: 500 }
    );
  }
}
