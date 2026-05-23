import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import {
  fetchOrderHistoryPage,
  fetchOrderHistoryStats,
  HISTORY_PAGE_SIZE,
  parseHistoryFilters,
  type HistorySearchParams,
} from "@/lib/orders/history-filters";
import { withRateLimit } from "@/lib/rate-limit";
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

  const [{ data: orders, count, error }, statsResult] = await Promise.all([
    fetchOrderHistoryPage(locationId, filters),
    fetchOrderHistoryStats(locationId, filters),
  ]);

  if (error) {
    return apiError(error.message, 500, undefined, noCache());
  }

  return apiSuccess(
    {
      orders: (orders ?? []) as OrderWithDetails[],
      statsOrders: (statsResult.data ?? []) as OrderWithDetails[],
      total: count ?? 0,
      page: filters.page,
      pageSize: HISTORY_PAGE_SIZE,
    },
    200,
    noCache()
  );
});
