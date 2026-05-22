import { QrCode } from "lucide-react";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#09090b]">
      <header className="border-b border-white/[0.06] px-5 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
            <QrCode className="size-3.5 text-zinc-300" strokeWidth={1.75} />
          </div>
          <span className="text-[13px] font-medium text-zinc-100">QR Order</span>
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-white/[0.02] p-8">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50">
            Request access
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Set up your venue on the QR Order platform
          </p>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
