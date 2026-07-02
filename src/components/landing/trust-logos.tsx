import { cn } from "@/lib/utils";

function LogoTile({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex shrink-0 items-center justify-center gap-2.5 px-2 py-2 opacity-80 transition hover:opacity-100",
        className
      )}
      aria-label={label}
    >
      {children}
    </li>
  );
}

/** Lowercase wordmark — clearer than complex SVG at small sizes. */
export function StripeLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap text-[17px] font-bold tracking-tight text-[#635BFF]",
        className
      )}
    >
      stripe
    </span>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5 shrink-0", className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function ApplePayLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[var(--lp-ink,#16140e)]",
        className
      )}
    >
      <AppleMark />
      <span className="text-sm font-semibold">Pay</span>
    </span>
  );
}

function GoogleGMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5 shrink-0", className)}
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GooglePayLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap",
        className
      )}
    >
      <GoogleGMark />
      <span className="text-sm font-semibold text-[var(--lp-ink,#16140e)]">Pay</span>
    </span>
  );
}

export function KassenSichVSeal() {
  return (
    <>
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-sm font-bold leading-none text-white"
      >
        ✓
      </span>
      <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-[var(--lp-muted,#5f5a50)]">
        KassenSichV
      </span>
    </>
  );
}

export function DsgvoBadge() {
  return (
    <>
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white"
      >
        EU
      </span>
      <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-[var(--lp-muted,#5f5a50)]">
        DSGVO
      </span>
    </>
  );
}

export function DatevLogo() {
  return (
    <span className="whitespace-nowrap font-bold tracking-tight text-green-500">
      DATEV
    </span>
  );
}

const TRUST_ITEMS = [
  { id: "stripe", label: "Stripe", node: <StripeLogo /> },
  { id: "apple", label: "Apple Pay", node: <ApplePayLogo /> },
  { id: "google", label: "Google Pay", node: <GooglePayLogo /> },
  { id: "kassen", label: "KassenSichV", node: <KassenSichVSeal /> },
  { id: "dsgvo", label: "DSGVO", node: <DsgvoBadge /> },
  { id: "datev", label: "DATEV", node: <DatevLogo /> },
] as const;

export function TrustLogoList() {
  return (
    <>
      {TRUST_ITEMS.map(({ id, label, node }) => (
        <LogoTile key={id} label={label}>
          {node}
        </LogoTile>
      ))}
    </>
  );
}
