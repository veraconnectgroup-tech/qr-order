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
        "flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3",
        className
      )}
      aria-label={label}
    >
      {children}
    </li>
  );
}

export function StripeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-[22px] w-auto", className)}
      aria-hidden
    >
      <path
        fill="#635BFF"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M59.64 14.28h-8.06c0 1.68-.84 2.52-2.52 2.52-1.47 0-2.31-.63-2.31-1.68 0-1.05.84-1.68 2.73-1.89l3.78-.42c3.57-.42 5.46-2.1 5.46-5.25 0-3.57-2.94-5.67-7.77-5.67-4.83 0-7.77 2.31-8.06 6.51h8.06c0-1.47.84-2.31 2.31-2.31 1.26 0 2.1.63 2.1 1.47 0 .84-.63 1.26-2.31 1.47l-3.78.42c-3.78.42-5.67 2.1-5.67 5.46 0 3.57 2.94 5.88 7.98 5.88 5.04 0 8.19-2.31 8.48-6.93ZM40.74 5.04c-1.68 0-2.94.84-3.57 2.31l-.21-2.1h-7.35v19.53h8.06V13.44c0-1.68.84-2.52 2.31-2.52 1.26 0 2.1.63 2.52 1.68l7.56-1.47c-.63-3.57-3.15-6.09-7.32-6.09ZM25.62 5.04c-4.83 0-7.98 2.52-7.98 6.72 0 4.41 3.36 6.3 9.03 6.93l2.31.21c1.47.21 2.1.63 2.1 1.26 0 .84-.84 1.47-2.52 1.47-1.89 0-3.15-.84-3.36-2.31h-8.06c.42 4.62 3.99 7.14 11.21 7.14 6.72 0 10.92-2.73 10.92-7.14 0-4.41-3.36-6.3-9.03-6.93l-2.31-.21c-1.47-.21-2.1-.63-2.1-1.26 0-.84.84-1.47 2.31-1.47 1.68 0 2.73.63 2.94 1.89h8.06c-.42-4.2-3.78-6.51-9.03-6.51ZM0 5.25h8.06v19.53H0V5.25Z"
      />
    </svg>
  );
}

export function ApplePayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 50 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-[20px] w-auto", className)}
      aria-hidden
    >
      <path
        fill="#ffffff"
        d="M8.02 2.84c-.47.56-1.22.99-1.97.93-.09-.75.28-1.54.72-2.03.47-.56 1.28-.97 1.94-.94.08.78-.23 1.53-.69 2.04Zm.66 1.06c-1.09-.06-2.01.62-2.53.62-.52 0-1.31-.59-2.16-.57-1.11.02-2.14.65-2.71 1.65-1.16 2.01-.3 4.99.83 6.62.55.8 1.2 1.69 2.06 1.66.83-.03 1.14-.54 2.14-.54 1 0 1.28.54 2.15.52.89-.01 1.45-.81 1.99-1.62.63-.92.89-1.81.91-1.86-.02-.01-1.75-.67-1.77-2.66-.02-1.67 1.37-2.47 1.43-2.52-1.22-1.79-3.12-2.03-3.79-2.06ZM16.5 3.5v12.5h2.1V9.8h2.93c2.68 0 4.57-1.83 4.57-4.65 0-2.76-1.85-4.65-4.47-4.65H16.5Zm2.1 1.78h2.44c1.86 0 2.93 1 2.93 2.87 0 1.9-1.07 2.87-2.95 2.87h-2.42V5.28ZM28.8 16.12c1.12 0 2.15-.57 2.62-1.47h.04v1.35h1.96V8.5c0-2.04-1.63-3.35-4.15-3.35-2.34 0-4.07 1.33-4.13 3.16h1.9c.16-.87.94-1.44 2.15-1.44 1.39 0 2.17.65 2.17 1.84v.8l-2.83.17c-2.64.16-4.07 1.24-4.07 3.1 0 1.9 1.47 3.14 3.54 3.14Zm.55-1.63c-1.2 0-1.98-.58-1.98-1.46 0-.93.75-1.47 2.18-1.56l2.52-.16v.83c0 1.36-1.1 2.35-2.72 2.35ZM38.5 20c2.02 0 2.97-.77 3.8-3.12l3.63-10.38h-2.1l-2.54 8.22h-.04l-2.54-8.22h-2.16l3.72 10.42-.2.63c-.33 1.05-.87 1.46-1.83 1.46-.17 0-.5-.02-.63-.04v1.6c.13.03.67.05.86.05Z"
      />
    </svg>
  );
}

export function GooglePayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-[22px] w-auto", className)}
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.8 12.2v2.4h6.7c-.3 1.5-1.1 2.8-2.3 3.6v3h3.7c2.2-2 3.5-5 3.5-8.5 0-.8-.1-1.6-.2-2.5H22.8z"
      />
      <path
        fill="#34A853"
        d="M12 23.2c3.1 0 5.7-1 7.6-2.8l-3.7-3c-1 0.7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.5v3.1C3.4 20.7 7.4 23.2 12 23.2z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.7c-.2-.7-.3-1.4-.3-2.2s.1-1.5.3-2.2V7.2H1.5C.5 9.3 0 11.6 0 14.5s.5 5.2 1.5 7.3l4.1-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.1 15.1 0 12 0 7.4 0 3.4 2.5 1.5 6.2l4.1 3.1c.9-2.8 3.4-4.8 6.4-4.8z"
      />
      <path
        fill="#ffffff"
        d="M35.5 6.5h2.1v11h-2.1V6.5Zm10.2 0c2.5 0 4.3 1.9 4.3 4.7v6.3h-2.1v-1.4h-.1c-.5.9-1.6 1.6-3 1.6-2.1 0-3.5-1.4-3.5-3.3 0-2.1 1.7-3.4 4.4-3.4h1.9v-.2c0-1.1-.7-1.8-1.9-1.8-1.1 0-1.8.5-2 1.3h-2c.2-1.8 1.7-3.2 4-3.2Zm-2.8 10.5c1.2 0 2.3-.7 2.7-1.7v-1.3h-1.9c-1.3 0-2 .5-2 1.2 0 .7.6 1.2 1.2 1.2Zm8.5-10.2h2.1v11h-2.1v-11Z"
      />
    </svg>
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
      <span className="text-sm font-semibold tracking-wide text-zinc-300">
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
      <span className="text-sm font-semibold tracking-wide text-zinc-300">
        DSGVO
      </span>
    </>
  );
}

export function DatevLogo() {
  return (
    <span className="font-bold tracking-tight text-green-500">DATEV</span>
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
