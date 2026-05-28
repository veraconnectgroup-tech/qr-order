import { resolveWorldOrderTell } from "@/lib/denis/loop/tell-world-order";
import { buildViewHeadline } from "@/lib/denis/loop/project-view-layers";

export type WorldTellUnificationResult = {
  passed: boolean;
  errors: string[];
};

/** Phase D — push body, dock headline, and transcript share one TELL string. */
export function runWorldTellUnificationFixture(): WorldTellUnificationResult {
  const errors: string[] = [];
  const tell = resolveWorldOrderTell({
    signal: "commerce.order_status",
    status: "ready",
    previousStatus: "preparing",
    orderNumber: 42,
    menuLocale: "de",
  });

  if (!tell) {
    errors.push("expected tell for ready transition");
    return { passed: false, errors };
  }

  const headline = buildViewHeadline(null, "waiting", tell.message);
  if (headline !== tell.message) {
    errors.push("headline must equal tell.message");
  }

  if (!tell.push) {
    errors.push("ready status should trigger guest push");
  }

  return { passed: errors.length === 0, errors };
}
