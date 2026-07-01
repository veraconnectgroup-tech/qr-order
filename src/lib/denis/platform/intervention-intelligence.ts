export type InterventionJournalInsight = {
  evaluatedSpeak: number;
  evaluatedSilence: number;
  evaluatedDefer: number;
  committed: number;
  declined: number;
  expired: number;
  superseded: number;
  byRuleId: Record<string, number>;
  /** Share of IJS speak decisions that led to committed nudges (shadow accuracy proxy). */
  shadowAccuracy: number | null;
  suggestedAction: string | null;
};

function countOutcomePrefix(
  byOutcome: Record<string, number> | null | undefined,
  prefix: string
): number {
  let total = 0;
  for (const [key, value] of Object.entries(byOutcome ?? {})) {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      total += value;
    }
  }
  return total;
}

export function analyzeInterventionJournal(input: {
  byOutcome: Record<string, number> | null | undefined;
  byRuleId?: Record<string, number>;
  totalEvaluations?: number;
}): InterventionJournalInsight {
  const evaluatedSpeak = countOutcomePrefix(input.byOutcome, "ijs:evaluated:speak");
  const evaluatedSilence = countOutcomePrefix(
    input.byOutcome,
    "ijs:evaluated:silence"
  );
  const evaluatedDefer = countOutcomePrefix(input.byOutcome, "ijs:evaluated:defer");
  const committed = countOutcomePrefix(input.byOutcome, "ijs:committed");
  const declined = countOutcomePrefix(input.byOutcome, "ijs:declined");
  const expired = countOutcomePrefix(input.byOutcome, "ijs:expired");
  const superseded = countOutcomePrefix(input.byOutcome, "ijs:superseded");

  const totalEvaluations =
    input.totalEvaluations ??
    evaluatedSpeak + evaluatedSilence + evaluatedDefer;

  const shadowDenominator = evaluatedSpeak + evaluatedSilence;
  const shadowAccuracy =
    shadowDenominator >= 5
      ? Math.round((committed / shadowDenominator) * 100) / 100
      : null;

  let suggestedAction: string | null = null;
  if (totalEvaluations < 5) {
    suggestedAction =
      "Premalo IJS evaluacija — ostavi shadow mod još nekoliko dana.";
  } else if (evaluatedSilence > evaluatedSpeak * 2) {
    suggestedAction =
      "IJS često bira tišinu — proveri da li su manifest pravila previše restriktivna.";
  } else if (shadowAccuracy != null && shadowAccuracy < 0.25) {
    suggestedAction =
      "Niska shadow tačnost — pregledaj frustration_gate i dessert_window pre enforce moda.";
  } else if (shadowAccuracy != null && shadowAccuracy >= 0.5) {
    suggestedAction =
      "Shadow izgleda stabilno — razmotri enforce nakon 7 dana bez regresije.";
  }

  return {
    evaluatedSpeak,
    evaluatedSilence,
    evaluatedDefer,
    committed,
    declined,
    expired,
    superseded,
    byRuleId: input.byRuleId ?? {},
    shadowAccuracy,
    suggestedAction,
  };
}

export function formatInterventionDigestLines(
  insight: InterventionJournalInsight
): string[] {
  const lines: string[] = [];
  const total =
    insight.evaluatedSpeak + insight.evaluatedSilence + insight.evaluatedDefer;

  if (total === 0) return lines;

  lines.push(
    `IJS evaluacija: ${total} (speak ${insight.evaluatedSpeak} · silence ${insight.evaluatedSilence} · defer ${insight.evaluatedDefer})`
  );

  if (insight.shadowAccuracy != null) {
    lines.push(`Shadow tačnost: ${Math.round(insight.shadowAccuracy * 100)}%`);
  }

  const topRules = Object.entries(insight.byRuleId)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  for (const [ruleId, count] of topRules) {
    lines.push(`Pravilo ${ruleId}: ${count}×`);
  }

  if (insight.suggestedAction) {
    lines.push(insight.suggestedAction);
  }

  return lines;
}
