import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { withStaffRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import type { Staff } from "@/types";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MAX_LIMIT = 100;

type SessionRow = {
  id: string;
  table_id: string;
  status: string;
  bill_status: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string;
  closed_by: string | null;
};

type OrderAggRow = {
  session_id: string | null;
  total: number;
  tip_amount: number | null;
  payment_status: string;
  payment_method: string;
};

async function loadStaff(): Promise<Staff | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  return (staff as Staff | null) ?? null;
}

function dayBoundsUtc(date: string) {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  return { dayStart, dayEnd };
}

function aggregateOrdersBySession(orders: OrderAggRow[]) {
  const bySession = new Map<
    string,
    {
      order_count: number;
      total: number;
      paid_total: number;
      unpaid_total: number;
      payment_methods: Set<string>;
    }
  >();

  for (const order of orders) {
    if (!order.session_id) continue;

    const entry = bySession.get(order.session_id) ?? {
      order_count: 0,
      total: 0,
      paid_total: 0,
      unpaid_total: 0,
      payment_methods: new Set<string>(),
    };

    const orderTotal = Number(order.total) + Number(order.tip_amount ?? 0);
    entry.order_count += 1;
    entry.total += orderTotal;

    if (isPaidPaymentStatus(order.payment_status)) {
      entry.paid_total += orderTotal;
    } else {
      entry.unpaid_total += orderTotal;
    }

    if (order.payment_method && order.payment_method !== "unset") {
      entry.payment_methods.add(order.payment_method);
    }

    bySession.set(order.session_id, entry);
  }

  return bySession;
}

export const GET = withErrorHandler(
  "sessions-history-get",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await loadStaff();
    if (
      !staff ||
      !["owner", "manager", "staff", "waiter"].includes(staff.role)
    ) {
      return apiError("Unauthorized.", 401);
    }

    const url = new URL(req.url);
    const locationId = url.searchParams.get("location_id");
    const dateParam =
      url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.floor(limitRaw)), MAX_LIMIT)
      : 50;

    if (!locationId || !isUuid(locationId)) {
      return apiError("Invalid location_id.", 400);
    }

    const parsedDate = dateSchema.safeParse(dateParam);
    if (!parsedDate.success) {
      return apiError("Invalid date. Use YYYY-MM-DD.", 400);
    }

    const admin = createAdminClient();

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", locationId)
      .maybeSingle();

    if (!location || (location as { org_id: string }).org_id !== staff.org_id) {
      return apiError("Unauthorized.", 403);
    }

    if (staff.location_id && staff.location_id !== locationId) {
      return apiError("Unauthorized.", 403);
    }

    const { dayStart, dayEnd } = dayBoundsUtc(parsedDate.data);

    const { data: sessionsRaw, error: sessionsError } = await admin
      .from("table_sessions")
      .select(
        "id, table_id, status, bill_status, opened_at, closed_at, opened_by, closed_by"
      )
      .eq("location_id", locationId)
      .eq("status", "closed")
      .gte("closed_at", dayStart)
      .lte("closed_at", dayEnd)
      .order("closed_at", { ascending: false })
      .limit(limit);

    if (sessionsError) {
      return apiError(sessionsError.message, 500);
    }

    const sessions = (sessionsRaw ?? []) as SessionRow[];

    if (sessions.length === 0) {
      return apiSuccess({ sessions: [], date: parsedDate.data, limit });
    }

    const sessionIds = sessions.map((session) => session.id);
    const tableIds = [...new Set(sessions.map((session) => session.table_id))];

    const [{ data: tablesRaw }, { data: ordersRaw, error: ordersError }] =
      await Promise.all([
        admin
          .from("tables")
          .select("id, name, zone_id")
          .in("id", tableIds)
          .is("deleted_at", null),
        admin
          .from("orders")
          .select("session_id, total, tip_amount, payment_status, payment_method")
          .in("session_id", sessionIds)
          .not("status", "in", '("rejected","cancelled")'),
      ]);

    if (ordersError) {
      return apiError(ordersError.message, 500);
    }

    const tables = (tablesRaw ?? []) as Array<{
      id: string;
      name: string;
      zone_id: string | null;
    }>;

    const zoneIds = [
      ...new Set(
        tables
          .map((table) => table.zone_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const { data: zonesRaw } =
      zoneIds.length > 0
        ? await admin.from("zones").select("id, name").in("id", zoneIds)
        : { data: [] };

    const zoneMap = new Map(
      ((zonesRaw ?? []) as Array<{ id: string; name: string }>).map((zone) => [
        zone.id,
        zone.name,
      ])
    );

    const tableMap = new Map(
      tables.map((table) => [
        table.id,
        {
          name: table.name,
          zone_name: table.zone_id ? (zoneMap.get(table.zone_id) ?? null) : null,
        },
      ])
    );

    const orderAgg = aggregateOrdersBySession(
      (ordersRaw ?? []) as OrderAggRow[]
    );

    const enrichedSessions = sessions.map((session) => {
      const table = tableMap.get(session.table_id);
      const agg = orderAgg.get(session.id) ?? {
        order_count: 0,
        total: 0,
        paid_total: 0,
        unpaid_total: 0,
        payment_methods: new Set<string>(),
      };

      return {
        id: session.id,
        table_id: session.table_id,
        table_name: table?.name ?? "—",
        zone_name: table?.zone_name ?? null,
        status: session.status,
        bill_status: session.bill_status,
        opened_at: session.opened_at,
        closed_at: session.closed_at,
        opened_by: session.opened_by,
        closed_by: session.closed_by,
        order_count: agg.order_count,
        total: agg.total,
        paid_total: agg.paid_total,
        unpaid_total: agg.unpaid_total,
        payment_methods: [...agg.payment_methods],
      };
    });

    return apiSuccess({
      date: parsedDate.data,
      limit,
      sessions: enrichedSessions,
    });
  }
);
