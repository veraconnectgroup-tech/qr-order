export type ReviewFunnelInsight = {
  weekClicks: number;
  weekPositiveFeedback: number;
  conversionRate: number;
  clickedSessions: number;
  promptedEstimate: number;
  triggerAnalytics?: ReturnType<
    typeof import("@/lib/denis/commerce/experience/review-orchestration").aggregateReviewTriggerAnalytics
  >;
};

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Owner digest lines for Google review funnel (Q1). */
export function formatGoogleReviewDigestLines(
  insight: ReviewFunnelInsight
): string[] {
  if (insight.weekPositiveFeedback === 0 && insight.weekClicks === 0) {
    return ["Još nema dovoljno podataka za Google review funnel."];
  }

  const lines = [
    `Ove sedmice: ${insight.weekClicks} Google review klik(ova).`,
    `Conversion: ${pct(insight.conversionRate)} (${insight.promptedEstimate} pozitivnih feedback-a → ${insight.clickedSessions} klikova).`,
  ];

  if (insight.conversionRate >= 0.3) {
    lines.push("Preporuka: Funnel radi dobro — nastavite sa Google review URL-om u adminu.");
  } else if (insight.weekPositiveFeedback >= 5) {
    lines.push(
      "Preporuka: Više pozitivnih feedback-a nego klikova — proverite da li je Google review link aktivan."
    );
  }

  return lines;
}

/** L2 — conversion rate per trigger moment for owner digest. */
export function formatReviewTriggerAnalyticsLines(
  analytics: NonNullable<ReviewFunnelInsight["triggerAnalytics"]>
): string[] {
  const entries = Object.entries(analytics.byTrigger).filter(
    ([, row]) => row.prompted > 0
  );
  if (!entries.length) {
    return ["Još nema podataka po trigger momentu."];
  }

  return entries.map(([moment, row]) => {
    const rate = Math.round(row.rate * 100);
    return `${moment}: ${row.converted}/${row.prompted} (${rate}%)`;
  });
}

export function buildReviewFunnelInsight(input: {
  positiveFeedbackCount: number;
  googleReviewClickCount: number;
  clickedSessionCount: number;
}): ReviewFunnelInsight {
  const promptedEstimate = input.positiveFeedbackCount;
  const conversionRate =
    promptedEstimate > 0
      ? input.clickedSessionCount / promptedEstimate
      : 0;

  return {
    weekClicks: input.googleReviewClickCount,
    weekPositiveFeedback: input.positiveFeedbackCount,
    conversionRate,
    clickedSessions: input.clickedSessionCount,
    promptedEstimate,
  };
}
