"use client";

import { useMemo } from "react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  wt,
  type WaiterUiKey,
} from "@/lib/i18n/waiter-app-ui";

export function useWaiterI18n() {
  const { menuLocale } = useDashboard();

  return useMemo(
    () => ({
      menuLocale,
      t: (key: WaiterUiKey, vars?: Record<string, string | number>) =>
        wt(key, menuLocale, vars),
    }),
    [menuLocale]
  );
}
