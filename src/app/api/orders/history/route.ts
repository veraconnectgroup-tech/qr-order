import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import {
  applyHistoryFilters,
  applyHistorySearch,
  HISTORY_PAGE_SIZE,
  HISTORY_STATS_MAX_ROWS,
  ORDER_HISTORY_SELECT,
  parseHistoryFilters,
  type HistorySearchParams,
} from "@/lib/orders/history-filters";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderWithDetails } from "@/types";

export const GET = withErrorHandler("orders-history-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("Unauthorized.", 401, undefined, noCache());
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return apiError("No location assigned.", 400, undefined, noCache());
  }

  const sp = req.nextUrl.searchParams;
  const filters = parseHistoryFilters({
    preset: sp.get("preset") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    status: sp.get("status") ?? undefined,
    payment: sp.get("payment") ?? undefined,
    source: sp.get("source") ?? undefined,
    q: sp.get("q") ?? undefined,
    page: sp.get("page") ?? undefined,
  } satisfies HistorySearchParams);

  const admin = createAdminClient();
  let baseQuery = admin
    .from("orders")
    .select(ORDER_HISTORY_SELECT, { count: "exact" })
    .eq("location_id", locationId);

  baseQuery = applyHistoryFilters(baseQuery, filters);
  baseQuery = await applyHistorySearch(baseQuery, locationId, filters.search);

  const offset = (filters.page - 1) * HISTORY_PAGE_SIZE;
  const { data: orders, count, error } = await baseQuery
    .order("created_at", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE - 1);

  if (error) {
    return apiError(error.message, 500, undefined, noCache());
  }

  let statsQuery = admin
    .from("orders")
    .select(ORDER_HISTORY_SELECT)
    .eq("location_id", locationId);
  statsQuery = applyHistoryFilters(statsQuery, filters);
  statsQuery = await applyHistorySearch(statsQuery, locationId, filters.search);

  const { data: statsOrders } = await statsQuery
    .order("created_at", { ascending: false })
    .range(0, HISTORY_STATS_MAX_ROWS - 1);

  return apiSuccess(
    {
      orders: (orders ?? []) as OrderWithDetails[],
      statsOrders: (statsOrders ?? []) as OrderWithDetails[],
      total: count ?? 0,
      page: filters.page,
      pageSize: HISTORY_PAGE_SIZE,
    },
    200,
    noCache()
  );
});
