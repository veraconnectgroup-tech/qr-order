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
        "flex shrink-0 items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3",
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

export function ApplePayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 50 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-[50px] shrink-0", className)}
      aria-hidden
    >
      <path
        fill="#ffffff"
        d="M8.02 2.84c-.47.56-1.22.99-1.97.93-.09-.75.28-1.54.72-2.03.47-.56 1.28-.97 1.94-.94.08.78-.23 1.53-.69 2.04Zm.66 1.06c-1.09-.06-2.01.62-2.53.62-.52 0-1.31-.59-2.16-.57-1.11.02-2.14.65-2.71 1.65-1.16 2.01-.3 4.99.83 6.62.55.8 1.2 1.69 2.06 1.66.83-.03 1.14-.54 2.14-.54 1 0 1.28.54 2.15.52.89-.01 1.45-.81 1.99-1.62.63-.92.89-1.81.91-1.86-.02-.01-1.75-.67-1.77-2.66-.02-1.67 1.37-2.47 1.43-2.52-1.22-1.79-3.12-2.03-3.79-2.06ZM16.5 3.5v12.5h2.1V9.8h2.93c2.68 0 4.57-1.83 4.57-4.65 0-2.76-1.85-4.65-4.47-4.65H16.5Zm2.1 1.78h2.44c1.86 0 2.93 1 2.93 2.87 0 1.9-1.07 2.87-2.95 2.87h-2.42V5.28ZM28.8 16.12c1.12 0 2.15-.57 2.62-1.47h.04v1.35h1.96V8.5c0-2.04-1.63-3.35-4.15-3.35-2.34 0-4.07 1.33-4.13 3.16h1.9c.16-.87.94-1.44 2.15-1.44 1.39 0 2.17.65 2.17 1.84v.8l-2.83.17c-2.64.16-4.07 1.24-4.07 3.1 0 1.9 1.47 3.14 3.54 3.14Zm.55-1.63c-1.2 0-1.98-.58-1.98-1.46 0-.93.75-1.47 2.18-1.56l2.52-.16v.83c0 1.36-1.1 2.35-2.72 2.35ZM38.5 20c2.02 0 2.97-.77 3.8-3.12l3.63-10.38h-2.1l-2.54 8.22h-.04l-2.54-8.22h-2.16l3.72 10.42-.2.63c-.33 1.05-.87 1.46-1.83 1.46-.17 0-.5-.02-.63-.04v1.6c.13.03.67.05.86.05Z"
      />
    </svg>
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
      <span className="text-sm font-semibold text-white">Pay</span>
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
      <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-zinc-300">
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
      <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-zinc-300">
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
