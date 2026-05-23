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

export function ApplePayLogo() {
  return (
    <span className="flex items-center gap-1 text-white">
      <span className="text-lg leading-none" aria-hidden>
        {"\uF8FF"}
      </span>
      <span className="font-semibold">Pay</span>
    </span>
  );
}

export function GooglePayLogo() {
  return (
    <span className="flex items-center gap-0.5 font-semibold">
      <span className="text-[#4285F4]">G</span>
      <span className="text-[#EA4335]">o</span>
      <span className="text-[#FBBC05]">o</span>
      <span className="text-[#4285F4]">g</span>
      <span className="text-[#34A853]">l</span>
      <span className="text-[#EA4335]">e</span>
      <span className="ml-1 text-white">Pay</span>
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
