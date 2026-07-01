export type RetentionInsight = {
  winBackSent: number;
  winBackReturned: number;
  winBackReturnRate: number;
  weeklySpecialSent: number;
  weeklySpecialOrdered: number;
  churnRiskVipCount: number;
};

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function buildRetentionInsight(input: {
  winBackSent: number;
  winBackReturned: number;
  weeklySpecialSent: number;
  weeklySpecialOrdered: number;
  churnRiskVipCount: number;
}): RetentionInsight {
  return {
    winBackSent: input.winBackSent,
    winBackReturned: input.winBackReturned,
    winBackReturnRate:
      input.winBackSent > 0
        ? input.winBackReturned / input.winBackSent
        : 0,
    weeklySpecialSent: input.weeklySpecialSent,
    weeklySpecialOrdered: input.weeklySpecialOrdered,
    churnRiskVipCount: input.churnRiskVipCount,
  };
}

/** Owner digest lines for retention loop (Q2). */
export function formatRetentionDigestLines(insight: RetentionInsight): string[] {
  if (
    insight.winBackSent === 0 &&
    insight.weeklySpecialSent === 0 &&
    insight.churnRiskVipCount === 0
  ) {
    return ["Još nema dovoljno podataka za retention loop."];
  }

  const lines = [
    `Win-back poslano: ${insight.winBackSent} gostiju`,
    `Vratilo se: ${insight.winBackReturned} (${pct(insight.winBackReturnRate)})`,
    `Weekly special: ${insight.weeklySpecialSent} gostiju → ${insight.weeklySpecialOrdered} naručilo taj item`,
  ];

  if (insight.churnRiskVipCount > 0) {
    lines.push(
      `Churn risk: ${insight.churnRiskVipCount} VIP gostiju nisu bili ${45}+ dana`
    );
  }

  return lines;
}
