import { Lock, Shield } from "lucide-react";

function StripeMark() {
  return (
    <svg viewBox="0 0 60 25" className="h-4 w-auto fill-zinc-500" aria-hidden>
      <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.63 2.96-2.18 0-1.48-1.12-1.99-3.03-2.52l-1.02-.28c-2.53-.7-4.18-1.78-4.18-4.54 0-2.65 2.33-4.52 6.06-4.52 3.45 0 5.95 1.85 6.26 4.71h-7.95c-.17-1.6-1.38-2.35-2.79-2.35-1.52 0-2.48.75-2.48 2.01 0 1.28.98 1.76 2.9 2.29l1.02.28c2.82.78 4.47 1.87 4.47 4.65 0 2.82-2.4 4.63-6.35 4.63-3.75 0-6.11-1.72-6.42-4.88zM40.95 20.3c-1.44 0-2.32-.6-2.79-1.54l-.07 1.37h-7.02V.67h7.95v11.77c0 .96.08 1.92.17 2.87.45.96 1.28 1.47 2.48 1.47 2.05 0 3.03-1.67 3.03-4.52V.67h7.95v11.3c0 5.04-2.67 8.33-7.7 8.33zM22.37 20.3c-4.71 0-7.7-3.24-7.7-8.33V.67h7.95v11.03c0 2.01.96 3.24 2.67 3.24s2.67-1.23 2.67-3.24V.67h7.95v11.3c0 5.09-2.99 8.33-7.54 8.33zM0 .67h7.95v19.63H0V.67z" />
    </svg>
  );
}

export function CheckoutTrustBadges() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Lock className="size-3.5" />
          256-bit SSL
        </span>
        <StripeMark />
        <span className="flex items-center gap-1.5">
          <Shield className="size-3.5" />
          PCI DSS compliant
        </span>
      </div>
    </div>
  );
}
