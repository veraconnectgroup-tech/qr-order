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

export function StripeLogo() {
  return (
    <span className="font-bold tracking-tight text-[#635bff]">stripe</span>
  );
}

function AppleIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0 fill-white"
    >
      <path d="M12.152 7.896c-.948 0-2.415 1.078-3.96 1.04-2.001-.038-3.834-1.172-4.805-2.978-.988-1.806-.834-4.174.374-5.652.765-1.012 1.989-1.635 3.112-1.653.96.015 1.858.644 2.445.644.548 0 1.555-.625 2.627-.536 1.123.089 1.876.519 2.377 1.028-2.082 1.229-1.743 4.419.356 5.433-.433 1.124-1.022 2.228-1.844 3.217-.594.719-1.293 1.423-2.211 1.423zm-.3-10.896c.525.624.88 1.487.783 2.348-.752-.03-1.664-.498-2.179-1.122-.485-.589-.913-1.531-.793-2.42.845.065 1.707.444 2.189 1.194z" />
    </svg>
  );
}

export function ApplePayLogo() {
  return (
    <span className="flex items-center gap-1 font-medium text-white">
      <AppleIcon />
      Pay
    </span>
  );
}

function GoogleGIcon() {
  return (
    <span
      aria-hidden
      className="inline-grid size-5 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-full"
    >
      <span className="bg-[#4285F4]" />
      <span className="bg-[#EA4335]" />
      <span className="bg-[#FBBC05]" />
      <span className="bg-[#34A853]" />
    </span>
  );
}

export function GooglePayLogo() {
  return (
    <span className="flex items-center gap-1.5 font-medium text-white">
      <GoogleGIcon />
      Pay
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
