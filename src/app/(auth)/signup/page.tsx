import { QrCode } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950">
            <QrCode className="size-4 text-zinc-300" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            QR Order
          </span>
        </div>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-50">
          Request access
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-zinc-400">
          Set up your venue on the QR Order platform
        </p>
        <SignupForm />
      </div>
    </div>
  );
}
