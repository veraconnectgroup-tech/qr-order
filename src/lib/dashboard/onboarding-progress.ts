export const ONBOARDING_STEP_IDS = [
  "basics",
  "branding",
  "menu",
  "tables",
  "stripe",
  "fiscal",
  "denis",
  "qr",
  "test_order",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStepId, string> = {
  basics: "Osnovni podaci",
  branding: "Logo & branding",
  menu: "Meni import",
  tables: "Stolovi",
  stripe: "Stripe Connect",
  fiscal: "Fiskalizacija",
  denis: "Denis config",
  qr: "QR kodovi",
  test_order: "Test order",
};

export type OnboardingProgressState = {
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
};

export const SKIP_STEP_WARNINGS: Partial<Record<OnboardingStepId, string>> = {
  branding: "Gosti neće videti vaš brend na QR karticama.",
  menu: "Bez proizvoda ne možete primati porudžbine.",
  tables: "Bez stolova nema QR naručivanja.",
  stripe: "Plaćanje samo na kasi — kartice na stolu neće raditi.",
  fiscal: "Bez fiskalnih podataka računi nisu u skladu sa zakonom.",
  denis: "Denis koristi generičke odgovore bez playbook-a.",
  qr: "QR kartice možete štampati kasnije iz dashboard-a.",
  test_order: "Preporučujemo probnu porudžbinu pre go-live.",
};

export function emptyOnboardingProgress(): OnboardingProgressState {
  return { completedSteps: [], skippedSteps: [] };
}

export function computeOnboardingCompletionPercent(
  progress: OnboardingProgressState
): number {
  const touched = new Set([
    ...progress.completedSteps,
    ...progress.skippedSteps,
  ]);
  return Math.round((touched.size / ONBOARDING_STEP_IDS.length) * 100);
}

export function markStepCompleted(
  progress: OnboardingProgressState,
  stepId: OnboardingStepId
): OnboardingProgressState {
  return {
    completedSteps: [
      ...new Set([...progress.completedSteps.filter((id) => id !== stepId), stepId]),
    ],
    skippedSteps: progress.skippedSteps.filter((id) => id !== stepId),
  };
}

export function markStepSkipped(
  progress: OnboardingProgressState,
  stepId: OnboardingStepId
): OnboardingProgressState {
  return {
    completedSteps: progress.completedSteps.filter((id) => id !== stepId),
    skippedSteps: [...new Set([...progress.skippedSteps, stepId])],
  };
}

export type TableNumberingScheme = "table_n" | "t_n" | "numeric";

export function buildTableNames(
  count: number,
  scheme: TableNumberingScheme
): string[] {
  const safeCount = Math.max(1, Math.min(count, 24));
  return Array.from({ length: safeCount }, (_, index) => {
    const n = index + 1;
    if (scheme === "t_n") return `T${n}`;
    if (scheme === "numeric") return String(n);
    return `Table ${n}`;
  });
}

export function formatElapsedSinceRegistration(createdAtIso: string | null): string {
  if (!createdAtIso) return "—";
  const started = new Date(createdAtIso).getTime();
  if (!Number.isFinite(started)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - started) / 60_000));
  if (minutes < 15) {
    return `${minutes} min · cilj < 15 min`;
  }
  return `${minutes} min`;
}

export function isWithinTargetTimeToOrder(createdAtIso: string | null): boolean {
  if (!createdAtIso) return true;
  const started = new Date(createdAtIso).getTime();
  if (!Number.isFinite(started)) return true;
  return Date.now() - started < 15 * 60_000;
}
