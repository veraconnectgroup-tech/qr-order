"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { QrTableCardPreview } from "@/components/design-system";
import {
  OnboardingFiscalStep,
  OnboardingGoLiveStep,
} from "@/components/dashboard/onboarding-fiscal-steps";
import { toast } from "sonner";
import { DashboardStripeConnect } from "@/components/dashboard/dashboard-stripe-connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guestTableUrl } from "@/lib/app-url";
import { generateTableQrDataUrl } from "@/lib/print/qr-table-card-print";
import {
  completeOnboarding,
  saveOnboardingFiscal,
  saveOnboardingProducts,
  saveOnboardingTables,
  saveOnboardingVenue,
  skipOnboardingPayment,
} from "@/lib/dashboard/onboarding-actions";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; menu_section: string };
type TableRow = { id: string; name: string; qr_token: string };

type ProductDraft = { name: string; price: string; categoryId: string };

const STEPS = [
  "Venue info",
  "Menu setup",
  "Tables & QR",
  "Payment",
  "Steuerliche Angaben",
  "Go live!",
] as const;

export function OnboardingWizard({
  orgName,
  orgSlug,
  logoUrl,
  address,
  city,
  postalCode,
  timezone,
  currency,
  categories,
  initialProducts,
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
}: {
  orgName: string;
  orgSlug: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  timezone: string;
  currency: string;
  categories: Category[];
  initialProducts: Array<{ name: string; price: number; category_id: string | null }>;
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
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [venue, setVenue] = useState({
    orgName,
    address: address ?? "",
    city: city ?? "",
    postalCode: postalCode ?? "",
    timezone: timezone || "Europe/Berlin",
    logoUrl: logoUrl ?? "",
  });
  const [products, setProducts] = useState<ProductDraft[]>(() => {
    if (initialProducts.length) {
      return initialProducts.slice(0, 5).map((p) => ({
        name: p.name,
        price: String(p.price),
        categoryId: p.category_id ?? categories[0]?.id ?? "",
      }));
    }
    return [
      { name: "", price: "", categoryId: categories[0]?.id ?? "" },
      { name: "", price: "", categoryId: categories[1]?.id ?? categories[0]?.id ?? "" },
      { name: "", price: "", categoryId: categories[0]?.id ?? "" },
    ];
  });
  const [tableNames, setTableNames] = useState<string[]>(() =>
    initialTables.length
      ? initialTables.map((t) => t.name)
      : ["Table 1", "Table 2", "Table 3"]
  );
  const [fiscal, setFiscal] = useState({
    steuernummer: steuernummer ?? "",
    ustIdNr: ustIdNr ?? "",
  });
  const [previewTable, setPreviewTable] = useState<TableRow | null>(
    initialTables[0] ?? null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;

  const autoSaveVenue = useCallback(
    (next: typeof venue) => {
      startTransition(async () => {
        const result = await saveOnboardingVenue(next);
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

  useEffect(() => {
    if (!previewTable) {
      setQrDataUrl(null);
      return;
    }
    const url = guestTableUrl(orgSlug, previewTable.qr_token, appUrl);
    generateTableQrDataUrl(url, 280).then(setQrDataUrl);
  }, [previewTable, orgSlug, appUrl]);

  const filledProducts = useMemo(
    () =>
      products.filter(
        (p) => p.name.trim() && p.price.trim() && p.categoryId
      ),
    [products]
  );

  const summaryCounts = useMemo(
    () => ({
      products: Math.max(productCount, filledProducts.length),
      categories: Math.max(
        categoryCount,
        new Set(filledProducts.map((p) => p.categoryId)).size
      ),
      tables: Math.max(tableCount, tableNames.filter(Boolean).length),
    }),
    [productCount, categoryCount, tableCount, filledProducts, tableNames]
  );

  function updateProduct(index: number, patch: Partial<ProductDraft>) {
    setProducts((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function addProductRow() {
    if (products.length >= 5) return;
    setProducts((rows) => [
      ...rows,
      { name: "", price: "", categoryId: categories[0]?.id ?? "" },
    ]);
  }

  function goNext() {
    if (step === 1) {
      if (filledProducts.length < 1) {
        toast.error("Add at least one product.");
        return;
      }
      startTransition(async () => {
        const result = await saveOnboardingProducts(
          filledProducts.map((p) => ({
            name: p.name.trim(),
            price: Number(p.price),
            categoryId: p.categoryId,
          }))
        );
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        setStep(2);
      });
      return;
    }

    if (step === 2) {
      startTransition(async () => {
        const result = await saveOnboardingTables(tableNames);
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        if ("tables" in result) {
          setPreviewTable(result.tables?.[0] ?? null);
        }
        setStep(3);
      });
      return;
    }

    if (step === 4) {
      startTransition(async () => {
        const result = await saveOnboardingFiscal(
          fiscal.steuernummer,
          fiscal.ustIdNr
        );
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        setStep(5);
      });
      return;
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function skipStep() {
    if (step === 3) {
      startTransition(async () => {
        const result = await skipOnboardingPayment();
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        setStep(4);
      });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function finish() {
    startTransition(async () => {
      await completeOnboarding();
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6 md:py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-dash-accent">
          Setup wizard
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-dash-text">
          {STEPS[step]}
        </h1>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-dash-surface-raised">
          <div
            className="h-full rounded-full bg-dash-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-dash-text-disabled">
          Step {step + 1} of {STEPS.length}
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
              <Label htmlFor="logo">Logo URL (optional)</Label>
              <Input
                id="logo"
                value={venue.logoUrl}
                onChange={(e) =>
                  setVenue((v) => ({ ...v, logoUrl: e.target.value }))
                }
                placeholder="https://…"
                className="mt-1.5 border-dash-surface-overlay bg-dash-surface"
              />
            </div>
            <p className="text-xs text-dash-text-disabled">Changes save automatically.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-dash-text-muted">
              Add 3–5 products to get started. You can edit the full menu later.
            </p>
            {products.map((product, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-dash-border bg-dash-surface/60 p-4 sm:grid-cols-[1fr_120px_140px]"
              >
                <div>
                  <Label>Name</Label>
                  <Input
                    value={product.name}
                    onChange={(e) =>
                      updateProduct(index, { name: e.target.value })
                    }
                    className="mt-1 border-dash-surface-overlay bg-dash-surface"
                  />
                </div>
                <div>
                  <Label>Price ({currency})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.price}
                    onChange={(e) =>
                      updateProduct(index, { price: e.target.value })
                    }
                    className="mt-1 border-dash-surface-overlay bg-dash-surface"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    value={product.categoryId}
                    onChange={(e) =>
                      updateProduct(index, { categoryId: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded-md border border-dash-surface-overlay bg-dash-surface px-3 text-sm text-dash-text"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {products.length < 5 && (
              <Button
                type="button"
                variant="outline"
                onClick={addProductRow}
                className="border-dash-surface-overlay"
              >
                + Add product
              </Button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-dash-text-muted">
              Name your tables. QR codes are generated automatically.
            </p>
            {tableNames.map((name, index) => (
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
            {tableNames.length < 8 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setTableNames((rows) => [...rows, `Table ${rows.length + 1}`])}
                className="border-dash-surface-overlay"
              >
                + Add table
              </Button>
            )}
            {previewTable && (
              <div className="mt-6 max-w-xs">
                <p className="mb-3 text-sm font-medium text-dash-text-secondary">
                  QR preview
                </p>
                <QrTableCardPreview
                  venueName={venue.orgName}
                  tableName={previewTable.name}
                  qrDataUrl={qrDataUrl}
                  locale={menuLocale}
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-dash-text-muted">
              Connect Stripe for card payments, or skip to accept pay-at-bar only.
            </p>
            <DashboardStripeConnect
              connected={stripeOnboarded}
              accountId={stripeAccountId}
              platformReady={stripePlatformReady}
              currency={currency}
            />
          </div>
        )}

        {step === 4 && (
          <OnboardingFiscalStep
            tssId={tssId}
            steuernummer={fiscal.steuernummer}
            ustIdNr={fiscal.ustIdNr}
            onChange={(patch) => setFiscal((f) => ({ ...f, ...patch }))}
          />
        )}

        {step === 5 && (
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
        {step < 5 && step !== 0 && (
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
        {step < 5 ? (
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
