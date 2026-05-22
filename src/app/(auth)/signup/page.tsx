import { QrCode } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <QrCode className="size-6 text-blue-600" />
          <span className="text-xl font-bold">QR Order</span>
        </div>
        <h1 className="text-center text-2xl font-bold">Kreiraj nalog</h1>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Postavi svoj lokal na QR Order platformi
        </p>
        <SignupForm />
      </div>
    </div>
  );
}
