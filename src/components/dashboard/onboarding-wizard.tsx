"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { QrTableCardPreview } from "@/components/design-system";
import {
  OnboardingFiscalStep,
  OnboardingGoLiveStep,
} from "@/components/dashboard/onboarding-fiscal-steps";
import { OnboardingMenuImport } from "@/components/dashboard/onboarding-menu-import";
import { QrPrintSheet } from "@/components/dashboard/qr-print-sheet";
import { toast } from "sonner";
import { DashboardStripeConnect } from "@/components/dashboard/dashboard-stripe-connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guestTableUrl } from "@/lib/app-url";
import { generateBrandedQrDataUrl } from "@/lib/qr/branded-qr";
import {
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEP_LABELS,
  SKIP_STEP_WARNINGS,
  buildTableNames,
  computeOnboardingCompletionPercent,
  emptyOnboardingProgress,
  formatElapsedSinceRegistration,
  isWithinTargetTimeToOrder,
  markStepCompleted,
  markStepSkipped,
  type OnboardingProgressState,
  type TableNumberingScheme,
} from "@/lib/dashboard/onboarding-progress";
import {
  completeOnboarding,
  saveOnboardingBranding,
  saveOnboardingDenisConfig,
  saveOnboardingFiscal,
  saveOnboardingProgress,
  saveOnboardingTables,
  saveOnboardingVenue,
  skipOnboardingPayment,
} from "@/lib/dashboard/onboarding-actions";
import { PLAYBOOK_PACK_REGISTRY } from "@/lib/denis/cognition/manifest/playbook-pack-registry";
import type { VenuePlaybookTone } from "@/lib/admin/generate-venue-playbook";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; menu_section: string };
type TableRow = { id: string; name: string; qr_token: string };

const STEP_COUNT = ONBOARDING_STEP_IDS.length;

export function OnboardingWizard({
  orgName,
  orgSlug,
  logoUrl,
  primaryColor,
  address,
  city,
  postalCode,
  timezone,
  currency,
  categories,
  initialTables,
  stripeOnboarded,
  stripeAccountId,
  stripePlatformReady,
  tssId,
  steuernummer,
  ustIdNr,
  productCount,
  categoryCount,
  tableCount,
  appUrl,
  menuLocale,
  playbookPackId,
  denisTone,
  orgCreatedAt,
  initialProgress,
}: {
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  primaryColor: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  timezone: string;
  currency: string;
  categories: Category[];
  initialTables: TableRow[];
  stripeOnboarded: boolean;
  stripeAccountId: string | null;
  stripePlatformReady: boolean;
  tssId: string | null;
  steuernummer: string | null;
  ustIdNr: string | null;
  productCount: number;
  categoryCount: number;
  tableCount: number;
  appUrl: string;
  menuLocale?: string | null;
  playbookPackId?: string | null;
  denisTone?: VenuePlaybookTone | null;
  orgCreatedAt: string | null;
  initialProgress?: OnboardingProgressState | null;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<OnboardingProgressState>(
    initialProgress ?? emptyOnboardingProgress()
  );
  const [savedProductCount, setSavedProductCount] = useState(productCount);
  const [venue, setVenue] = useState({
    orgName,
    address: address ?? "",
    city: city ?? "",
    postalCode: postalCode ?? "",
    timezone: timezone || "Europe/Berlin",
    currency: currency || "EUR",
  });
  const [branding, setBranding] = useState({
    logoUrl: logoUrl ?? "",
    primaryColor: primaryColor || "#f97316",
  });
  const [tableCountInput, setTableCountInput] = useState(
    Math.max(initialTables.length, tableCount, 3)
  );
  const [numberingScheme, setNumberingScheme] =
    useState<TableNumberingScheme>("table_n");
  const [tableNames, setTableNames] = useState<string[]>(() =>
    initialTables.length
      ? initialTables.map((t) => t.name)
      : buildTableNames(3, "table_n")
  );
  const [savedTables, setSavedTables] = useState<TableRow[]>(initialTables);
  const [fiscal, setFiscal] = useState({
    steuernummer: steuernummer ?? "",
    ustIdNr: ustIdNr ?? "",
  });
  const [denis, setDenis] = useState({
    playbookPackId: playbookPackId ?? "",
    menuLocale: (menuLocale as "de" | "en" | "sr") ?? "de",
    tone: (denisTone ?? "friendly") as VenuePlaybookTone,
  });
  const [previewTable, setPreviewTable] = useState<TableRow | null>(
    initialTables[0] ?? null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const qrScanUrl = previewTable
    ? guestTableUrl(orgSlug, previewTable.qr_token, appUrl)
    : null;
  const displayedQrDataUrl = qrScanUrl ? qrDataUrl : null;

  const currentStepId = ONBOARDING_STEP_IDS[step]!;
  const completionPercent = computeOnboardingCompletionPercent(progress);
  const elapsedLabel = formatElapsedSinceRegistration(orgCreatedAt);
  const onTarget = isWithinTargetTimeToOrder(orgCreatedAt);

  const persistProgress = useCallback(
    (next: OnboardingProgressState) => {
      setProgress(next);
      startTransition(async () => {
        await saveOnboardingProgress({
          completedSteps: next.completedSteps,
          skippedSteps: next.skippedSteps,
        });
      });
    },
    []
  );

  const autoSaveVenue = useCallback(
    (next: typeof venue) => {
      startTransition(async () => {
        const result = await saveOnboardingVenue({
          ...next,
          currency: next.currency,
        });
        if ("error" in result && result.error) {
          toast.error(result.error);
        }
      });
    },
    []
  );

  useEffect(() => {
    if (step !== 0) return;
    const timer = window.setTimeout(() => autoSaveVenue(venue), 800);
    return () => window.clearTimeout(timer);
  }, [venue, step, autoSaveVenue]);

  function rebuildTableNames(count: number, scheme: TableNumberingScheme) {
    setTableNames(buildTableNames(count, scheme));
  }

  useEffect(() => {
    if (!qrScanUrl) return;
    let cancelled = false;
    void generateBrandedQrDataUrl({
      scanUrl: qrScanUrl,
      brandColor: branding.primaryColor,
      logoDataUrl: branding.logoUrl || null,
      width: 280,
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [qrScanUrl, branding.primaryColor, branding.logoUrl]);

  const summaryCounts = useMemo(
    () => ({
      products: Math.max(savedProductCount, productCount),
      categories: Math.max(categoryCount, categories.length),
      tables: Math.max(tableCount, savedTables.length, tableNames.filter(Boolean).length),
    }),
    [
      savedProductCount,
      productCount,
      categoryCount,
      categories.length,
      tableCount,
      savedTables.length,
      tableNames,
    ]
  );

  const demoGuestUrl = previewTable
    ? guestTableUrl(orgSlug, previewTable.qr_token, appUrl)
    : null;

  function completeCurrentStep() {
    persistProgress(markStepCompleted(progress, currentStepId));
  }

  function skipCurrentStep() {
    const warning = SKIP_STEP_WARNINGS[currentStepId];
    if (warning) toast.warning(warning);
    persistProgress(markStepSkipped(progress, currentStepId));
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function goNext() {
    if (step === 1) {
      startTransition(async () => {
        const result = await saveOnboardingBranding({
          logoUrl: branding.logoUrl,
          primaryColor: branding.primaryColor,
        });
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        completeCurrentStep();
        setStep(2);
      });
      return;
    }

    if (step === 3) {
      startTransition(async () => {
        const result = await saveOnboardingTables(tableNames);
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        if ("tables" in result && result.tables?.length) {
          setSavedTables(result.tables);
          setPreviewTable(result.tables[0] ?? null);
        }
        completeCurrentStep();
        setStep(4);
      });
      return;
    }

    if (step === 4 && !stripeOnboarded) {
      completeCurrentStep();
      setStep(5);
      return;
    }

    if (step === 5) {
      startTransition(async () => {
        const result = await saveOnboardingFiscal(
          fiscal.steuernummer,
          fiscal.ustIdNr
        );
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        completeCurrentStep();
        setStep(6);
      });
      return;
    }

    if (step === 6) {
      startTransition(async () => {
        const result = await saveOnboardingDenisConfig({
          playbookPackId: denis.playbookPackId || undefined,
          menuLocale: denis.menuLocale,
          tone: denis.tone,
        });
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        completeCurrentStep();
        setStep(7);
      });
      return;
    }

    if (step === 0) {
      completeCurrentStep();
    }

    if (step === 2 && savedProductCount < 1) {
      toast.error("Import or save at least one menu item.");
      return;
    }

    if (step === 2 || step === 7 || step === 8) {
      completeCurrentStep();
    }

    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function skipStep() {
    if (step === 4) {
      startTransition(async () => {
        const result = await skipOnboardingPayment();
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        skipCurrentStep();
      });
      return;
    }
    skipCurrentStep();
  }

  function finish() {
    completeCurrentStep();
    startTransition(async () => {
      await completeOnboarding();
    });
  }

  const playbookOptions = Object.keys(PLAYBOOK_PACK_REGISTRY);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6 md:py-10">
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-dash-accent">
              Setup wizard · novi restoran za 15 min
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-dash-text">
              {ONBOARDING_STEP_LABELS[currentStepId]}
            </h1>
          </div>
          <div className="text-right text-xs text-dash-text-disabled">
            <p>{completionPercent}% complete</p>
            <p className={cn(!onTarget && "text-amber-400")}>{elapsedLabel}</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-dash-surface-raised">
          <div
            className="h-full rounded-full bg-dash-accent transition-all duration-300"
            style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-dash-text-disabled">
          Step {step + 1} of {STEP_COUNT}
        </p>
      </div>

      <div className="flex-1">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="orgName">Venue name</Label>
              <Input
                id="orgName"
                value={venue.orgName}
                onChange={(e) =>
                  setVenue((v) => ({ ...v, orgName: e.target.value }))
                }
                className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={venue.address}
                onChange={(e) =>
                  setVenue((v) => ({ ...v, address: e.target.value }))
                }
                className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={venue.city}
                  onChange={(e) =>
                    setVenue((v) => ({ ...v, city: e.target.value }))
                  }
                  className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
                />
              </div>
              <div>
                <Label htmlFor="postal">Postal code</Label>
                <Input
                  id="postal"
                  value={venue.postalCode}
                  onChange={(e) =>
                    setVenue((v) => ({ ...v, postalCode: e.target.value }))
                  }
                  className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={venue.timezone}
                  onChange={(e) =>
                    setVenue((v) => ({ ...v, timezone: e.target.value }))
                  }
                  className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={venue.currency}
                  onChange={(e) =>
                    setVenue((v) => ({ ...v, currency: e.target.value }))
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 text-sm text-dash-text"
                >
                  {["EUR", "USD", "GBP", "CHF"].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-dash-text-disabled">Changes save automatically.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={branding.logoUrl}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, logoUrl: e.target.value }))
                }
                placeholder="https://…"
                className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
              />
            </div>
            <div>
              <Label htmlFor="primaryColor">Primary brand color</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input
                  id="primaryColor"
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding((b) => ({
                      ...b,
                      primaryColor: e.target.value,
                    }))
                  }
                  className="h-10 w-16 border-dash-surface-overlay bg-dash-surface p-1"
                />
                <Input
                  value={branding.primaryColor}
                  onChange={(e) =>
                    setBranding((b) => ({
                      ...b,
                      primaryColor: e.target.value,
                    }))
                  }
                  className="border-dash-surface-overlay bg-dash-surface"
                />
              </div>
            </div>
            {previewTable && displayedQrDataUrl && (
              <div className="max-w-xs">
                <p className="mb-3 text-sm font-medium text-dash-text-secondary">
                  Branded QR preview
                </p>
                <QrTableCardPreview
                  venueName={venue.orgName}
                  tableName={previewTable.name}
                  qrDataUrl={displayedQrDataUrl}
                  locale={menuLocale}
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <OnboardingMenuImport
            categories={categories}
            currency={venue.currency}
            initialItems={[]}
            onSaved={(count) => setSavedProductCount(count)}
          />
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tableCount">Number of tables</Label>
                <Input
                  id="tableCount"
                  type="number"
                  min={1}
                  max={24}
                  value={tableCountInput}
                  onChange={(e) => {
                    const count = Number(e.target.value) || 1;
                    setTableCountInput(count);
                    rebuildTableNames(count, numberingScheme);
                  }}
                  className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
                />
              </div>
              <div>
                <Label htmlFor="numbering">Numbering scheme</Label>
                <select
                  id="numbering"
                  value={numberingScheme}
                  onChange={(e) => {
                    const scheme = e.target.value as TableNumberingScheme;
                    setNumberingScheme(scheme);
                    rebuildTableNames(tableCountInput, scheme);
                  }}
                  className="mt-1.5 h-9 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 text-sm text-dash-text"
                >
                  <option value="table_n">Table 1, Table 2…</option>
                  <option value="t_n">T1, T2…</option>
                  <option value="numeric">1, 2, 3…</option>
                </select>
              </div>
            </div>
            <p className="text-sm text-dash-text-muted">
              QR codes are generated automatically when you continue.
            </p>
            {tableNames.slice(0, 6).map((name, index) => (
              <div key={index}>
                <Label>Table {index + 1}</Label>
                <Input
                  value={name}
                  onChange={(e) =>
                    setTableNames((rows) =>
                      rows.map((row, i) => (i === index ? e.target.value : row))
                    )
                  }
                  className="mt-1 border-dash-surface-overlay bg-dash-surface"
                />
              </div>
            ))}
            {tableNames.length > 6 && (
              <p className="text-xs text-dash-text-disabled">
                +{tableNames.length - 6} more tables
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-dash-text-muted">
              Connect Stripe for card payments, or skip to accept pay-at-bar only.
            </p>
            <DashboardStripeConnect
              connected={stripeOnboarded}
              accountId={stripeAccountId}
              platformReady={stripePlatformReady}
              currency={venue.currency}
            />
          </div>
        )}

        {step === 5 && (
          <OnboardingFiscalStep
            tssId={tssId}
            steuernummer={fiscal.steuernummer}
            ustIdNr={fiscal.ustIdNr}
            onChange={(patch) => setFiscal((f) => ({ ...f, ...patch }))}
          />
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="playbook">Playbook pack</Label>
              <select
                id="playbook"
                value={denis.playbookPackId}
                onChange={(e) =>
                  setDenis((d) => ({ ...d, playbookPackId: e.target.value }))
                }
                className="mt-1.5 h-9 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 text-sm text-dash-text"
              >
                <option value="">Auto-generate for venue</option>
                {playbookOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="menuLocale">Guest language</Label>
                <select
                  id="menuLocale"
                  value={denis.menuLocale}
                  onChange={(e) =>
                    setDenis((d) => ({
                      ...d,
                      menuLocale: e.target.value as "de" | "en" | "sr",
                    }))
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 text-sm text-dash-text"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                  <option value="sr">Srpski</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tone">Denis tone</Label>
                <select
                  id="tone"
                  value={denis.tone}
                  onChange={(e) =>
                    setDenis((d) => ({
                      ...d,
                      tone: e.target.value as VenuePlaybookTone,
                    }))
                  }
                  className="mt-1.5 h-9 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 text-sm text-dash-text"
                >
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                  <option value="efficient">Efficient</option>
                  <option value="playful_luxury">Playful luxury</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <QrPrintSheet
              orgSlug={orgSlug}
              venueName={venue.orgName}
              brandColor={branding.primaryColor}
              tables={savedTables}
              appUrl={appUrl}
            />
            {previewTable && displayedQrDataUrl && (
              <div className="max-w-xs">
                <QrTableCardPreview
                  venueName={venue.orgName}
                  tableName={previewTable.name}
                  qrDataUrl={displayedQrDataUrl}
                  locale={menuLocale}
                />
              </div>
            )}
          </div>
        )}

        {step === 8 && (
          <div className="space-y-5">
            <OnboardingGoLiveStep
              venueName={venue.orgName}
              venueAddress={venue.address}
              venueCity={venue.city}
              productCount={summaryCounts.products}
              categoryCount={summaryCounts.categories}
              tableCount={summaryCounts.tables}
              stripeOnboarded={stripeOnboarded}
              tssId={tssId}
              steuernummer={fiscal.steuernummer}
            />
            {demoGuestUrl && (
              <div className="rounded-xl border border-dash-border bg-dash-surface/60 p-4">
                <p className="text-sm font-medium text-dash-text-secondary">
                  Denis demo — test order with owner
                </p>
                <p className="mt-1 text-sm text-dash-text-muted">
                  Open the guest menu on your phone and place a test order before
                  go-live.
                </p>
                <Button
                  asChild
                  className="mt-3 bg-dash-accent hover:bg-dash-accent-hover"
                >
                  <Link href={demoGuestUrl} target="_blank" rel="noreferrer">
                    Open guest demo
                    <ExternalLink className="ms-2 size-4" />
                  </Link>
                </Button>
              </div>
            )}
            {!onTarget && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Target is under 15 minutes to first order — you can still finish
                  setup now.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-dash-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={step === 0 || pending}
          className="border-dash-surface-overlay"
        >
          <ArrowLeft className="me-2 size-4" />
          Back
        </Button>
        <div className="flex-1" />
        {step < STEP_COUNT - 1 && step !== 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={skipStep}
            disabled={pending}
            className="text-dash-text-muted"
          >
            Skip
          </Button>
        )}
        {step < STEP_COUNT - 1 ? (
          <Button
            type="button"
            onClick={goNext}
            disabled={pending}
            className="bg-dash-accent hover:bg-dash-accent-hover"
          >
            Continue
            <ArrowRight className="ms-2 size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={finish}
            disabled={pending}
            className={cn("bg-emerald-600 hover:bg-emerald-700")}
          >
            {pending ? "Wird gestartet…" : "Jetzt starten"}
          </Button>
        )}
      </div>
    </div>
  );
}
