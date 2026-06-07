import { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";
import {
  BROWSE_FOLD_SCENARIOS,
  type BrowseFoldScenario,
} from "@/lib/denis/eval/fixtures/browse/fold-scenarios";

export type BrowseFoldScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type BrowseFoldReport = {
  ok: boolean;
  scenarioCount: number;
  results: BrowseFoldScenarioResult[];
};

function runScenario(scenario: BrowseFoldScenario): BrowseFoldScenarioResult {
  const errors: string[] = [];
  const profile = foldBrowseProfile(scenario.timeline);
  const expect = scenario.expect;

  if (profile.eventCount !== expect.eventCount) {
    errors.push(`eventCount: expected ${expect.eventCount}, got ${profile.eventCount}`);
  }
  if (expect.browsedFood !== undefined && profile.browsedFood !== expect.browsedFood) {
    errors.push(`browsedFood: expected ${expect.browsedFood}, got ${profile.browsedFood}`);
  }
  if (
    expect.browsedDrinks !== undefined &&
    profile.browsedDrinks !== expect.browsedDrinks
  ) {
    errors.push(
      `browsedDrinks: expected ${expect.browsedDrinks}, got ${profile.browsedDrinks}`
    );
  }
  if (expect.topProductName !== undefined) {
    const top = profile.viewedProducts[0]?.productName ?? null;
    if (top !== expect.topProductName) {
      errors.push(`topProductName: expected ${expect.topProductName}, got ${top}`);
    }
  }
  if (expect.cartAbandonedCount !== undefined) {
    if (profile.cartAbandoned.length !== expect.cartAbandonedCount) {
      errors.push(
        `cartAbandonedCount: expected ${expect.cartAbandonedCount}, got ${profile.cartAbandoned.length}`
      );
    }
  }
  if (expect.totalBrowseMs !== undefined && profile.totalBrowseMs !== expect.totalBrowseMs) {
    errors.push(
      `totalBrowseMs: expected ${expect.totalBrowseMs}, got ${profile.totalBrowseMs}`
    );
  }

  return { id: scenario.id, passed: errors.length === 0, errors };
}

export function runBrowseFoldSuite(): BrowseFoldReport {
  const results = BROWSE_FOLD_SCENARIOS.map(runScenario);
  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}
