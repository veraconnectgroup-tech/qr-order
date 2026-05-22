import { QrCode } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <QrCode className="size-6 text-orange-500" />
          <span className="text-xl font-bold text-zinc-50">QR Order</span>
        </div>
        <h1 className="text-center text-2xl font-bold text-zinc-50">
          Sign in to your dashboard
        </h1>
        {urlError && (
          <p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-center text-sm text-orange-300">
            {urlError}
          </p>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
