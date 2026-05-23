import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createOrderFromCart, createOrderSchema } from "@/lib/orders/create-order";
import { withRateLimitScope } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimitScope(req, "orders");
    if (limited) return limited;

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
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
    logger.error("Create order error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Order could not be created. Please try again." },
      { status: 500 }
    );
  }
}
