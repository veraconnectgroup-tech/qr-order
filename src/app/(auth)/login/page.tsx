import { QrCode } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <QrCode className="size-6 text-orange-500" />
          <span className="text-xl font-bold text-zinc-50">QR Order</span>
        </div>
        <h1 className="text-center text-2xl font-bold text-zinc-50">
          Sign in to your dashboard
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
