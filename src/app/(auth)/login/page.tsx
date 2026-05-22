import { QrCode } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Authentication failed. Please try again.",
  config:
    "Server configuration is incomplete. Contact support or check environment variables.",
  no_access:
    "Your account is signed in but has no staff access. Contact your administrator or sign up a new venue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const urlError = params.error
    ? ERROR_MESSAGES[params.error] ?? "Sign in failed."
    : null;

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
            Sign in
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Access your venue dashboard
          </p>
          {urlError && (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {urlError}
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
