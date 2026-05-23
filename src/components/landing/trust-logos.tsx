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
        "flex shrink-0 items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-4 py-2.5",
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
    <span className="font-display text-[17px] font-semibold tracking-tight text-[#635bff]">
      stripe
    </span>
  );
}

export function ApplePayLogo() {
  return (
    <svg viewBox="0 0 50 20" className="h-4 w-auto fill-white" aria-hidden>
      <path d="M9.6 2.1c-.6.7-1.5 1.3-2.5 1.2-.1-1 .4-2 .9-2.7.6-.8 1.6-1.3 2.4-1.4.1 1.1-.3 2.1-.8 2.9zm.8 1.5c-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.1 0 1.9-1.1 2.6-2.2.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.4-.9-2.4-3.7 0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8zM18.5 1.5v16.9h2.7V9.8h3.8c3.5 0 6-2.4 6-5.7 0-3.3-2.4-5.6-5.9-5.6h-6.6zm2.7 2.2h3.2c2.4 0 3.8 1.3 3.8 3.5s-1.4 3.5-3.8 3.5h-3.2V3.7zm14.8 14.7c1.5 0 2.9-.8 3.5-2h.1v1.8h2.5V8.9c0-2.7-2.1-4.4-5.4-4.4-3 0-5.2 1.7-5.3 4.1h2.4c.2-1.2 1.3-2 2.9-2 1.9 0 2.9 1 2.9 2.5v1.1l-3.8.2c-3.6.2-5.5 1.7-5.5 4.2 0 2.5 1.9 4.1 4.7 4.1zm.7-2c-1.6 0-2.6-.8-2.6-2 0-1.2 1-2 3-2.1l3.4-.2v1.1c0 1.8-1.5 3.2-3.8 3.2z" />
    </svg>
  );
}

export function GooglePayLogo() {
  return (
    <svg viewBox="0 0 60 24" className="h-4 w-auto" aria-hidden>
      <path fill="#4285F4" d="M22.8 12.2v4.5h6.3c-.3 1.5-1.1 2.8-2.3 3.6v3h3.7c2.2-2 3.5-5 3.5-8.5 0-.6-.1-1.2-.2-1.6H22.8z" />
      <path fill="#34A853" d="M12 18.1c1.6 1.2 3.6 1.9 5.8 1.9 1.8 0 3.4-.6 4.6-1.6l3.5 2.7C23.8 22.8 21 24 17.8 24 11.4 24 6 19.8 4.2 14.2H.5v2.9C2.3 21.8 6.8 24 12 24z" />
      <path fill="#FBBC05" d="M4.2 14.2A8 8 0 0 1 3.6 12c0-.7.1-1.4.3-2V7.1H.5A11.9 11.9 0 0 0 0 12c0 1.9.5 3.7 1.3 5.3l2.9-2.1z" />
      <path fill="#EA4335" d="M12 4.8c2.1 0 4 .7 5.5 2.1l4.1-4.1C20.4 1.1 17.8 0 12 0 6.8 0 2.3 2.2.5 7.1l3.7 2.9C5.6 6.2 8.4 4.8 12 4.8z" />
      <path fill="#fff" d="M29.5 6.5h2.2v11h-2.2V6.5zm10.2 7.4c0-2.2-1.8-3.7-4.2-3.7-2.5 0-4.3 1.5-4.3 3.8s1.8 3.7 4.2 3.7c1.2 0 2.3-.5 3-1.3l1.6 1.5c-1.1 1.2-2.7 1.9-4.6 1.9-3.8 0-6.5-2.6-6.5-6.4s2.7-6.4 6.4-6.4c3.5 0 6.1 2.4 6.1 6.1 0 .4 0 .7-.1 1.1h-8.6v.1zm-6.1-1.8h6.5c-.2-1.3-1.2-2.2-2.8-2.2-1.7 0-2.9.9-3.7 2.2zM48 6.5h2.1v1.4h.1c.6-1 1.8-1.6 3.2-1.6 2.4 0 3.9 1.6 3.9 4.3v6.9H55v-6.5c0-1.8-1-2.8-2.5-2.8-1.6 0-2.7 1.1-2.7 2.9v6.4H48V6.5z" />
    </svg>
  );
}

export function KassenSichVSeal() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 items-center justify-center rounded-full border-2 border-emerald-500/60 bg-emerald-500/10">
        <svg viewBox="0 0 24 24" className="size-4 text-emerald-400" aria-hidden>
          <path
            fill="currentColor"
            d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 16l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"
          />
        </svg>
      </div>
      <span className="text-[12px] font-semibold tracking-wide text-zinc-300">
        KassenSichV
      </span>
    </div>
  );
}

export function DsgvoBadge() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 items-center justify-center rounded-md border border-blue-500/40 bg-blue-500/10">
        <span className="text-[9px] font-bold text-blue-400">EU</span>
      </div>
      <span className="text-[12px] font-semibold tracking-wide text-zinc-300">
        DSGVO
      </span>
    </div>
  );
}

export function DatevLogo() {
  return (
    <span className="font-display text-[15px] font-bold tracking-tight text-[#009640]">
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

export function TrustLogoMarquee() {
  const track = [...TRUST_ITEMS, ...TRUST_ITEMS];

  return (
    <ul className="landing-marquee-track flex w-max gap-3 px-4">
      {track.map(({ id, label, node }, i) => (
        <LogoTile key={`${id}-${i}`} label={label}>
          {node}
        </LogoTile>
      ))}
    </ul>
  );
}
